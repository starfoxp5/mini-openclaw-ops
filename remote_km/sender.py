#!/usr/bin/env python3
import argparse
import socket
import time
from typing import Optional

import Quartz

from common import pack_message


TOGGLE_KEYCODE_R = 15
TOGGLE_MASK = (
    Quartz.kCGEventFlagMaskControl
    | Quartz.kCGEventFlagMaskAlternate
    | Quartz.kCGEventFlagMaskCommand
)


class SenderState:
    def __init__(self, target: str, port: int, secret: str):
        self.target = target
        self.port = port
        self.secret = secret
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.enabled = False
        self.seq = 0
        self.main_bounds = Quartz.CGDisplayBounds(Quartz.CGMainDisplayID())

    def send(self, msg):
        self.seq += 1
        msg["seq"] = self.seq
        msg["ts"] = time.time()
        data = pack_message(msg, self.secret)
        self.sock.sendto(data, (self.target, self.port))

    def normalize_point(self, x: float, y: float):
        b = self.main_bounds
        w = max(1.0, b.size.width)
        h = max(1.0, b.size.height)
        nx = (x - b.origin.x) / w
        ny = (y - b.origin.y) / h
        nx = max(0.0, min(1.0, nx))
        ny = max(0.0, min(1.0, ny))
        return nx, ny


STATE: Optional[SenderState] = None


def button_for_event_type(event_type):
    if event_type in (Quartz.kCGEventLeftMouseDown, Quartz.kCGEventLeftMouseUp, Quartz.kCGEventLeftMouseDragged):
        return "left"
    if event_type in (Quartz.kCGEventRightMouseDown, Quartz.kCGEventRightMouseUp, Quartz.kCGEventRightMouseDragged):
        return "right"
    return "middle"


def event_callback(proxy, event_type, event, refcon):
    global STATE
    s = STATE
    if s is None:
        return event

    if event_type == Quartz.kCGEventKeyDown:
        keycode = int(Quartz.CGEventGetIntegerValueField(event, Quartz.kCGKeyboardEventKeycode))
        flags = int(Quartz.CGEventGetFlags(event))
        if keycode == TOGGLE_KEYCODE_R and (flags & TOGGLE_MASK) == TOGGLE_MASK:
            s.enabled = not s.enabled
            print(f"[sender] forwarding {'ON' if s.enabled else 'OFF'}")
            return None

    if not s.enabled:
        return event

    flags = int(Quartz.CGEventGetFlags(event))

    if event_type in (Quartz.kCGEventKeyDown, Quartz.kCGEventKeyUp, Quartz.kCGEventFlagsChanged):
        keycode = int(Quartz.CGEventGetIntegerValueField(event, Quartz.kCGKeyboardEventKeycode))
        s.send(
            {
                "t": "key",
                "et": int(event_type),
                "keycode": keycode,
                "flags": flags,
            }
        )
        return None

    if event_type in (
        Quartz.kCGEventMouseMoved,
        Quartz.kCGEventLeftMouseDragged,
        Quartz.kCGEventRightMouseDragged,
        Quartz.kCGEventOtherMouseDragged,
    ):
        loc = Quartz.CGEventGetLocation(event)
        nx, ny = s.normalize_point(loc.x, loc.y)
        s.send({"t": "move", "nx": nx, "ny": ny, "flags": flags})
        return None

    if event_type in (
        Quartz.kCGEventLeftMouseDown,
        Quartz.kCGEventLeftMouseUp,
        Quartz.kCGEventRightMouseDown,
        Quartz.kCGEventRightMouseUp,
        Quartz.kCGEventOtherMouseDown,
        Quartz.kCGEventOtherMouseUp,
    ):
        loc = Quartz.CGEventGetLocation(event)
        nx, ny = s.normalize_point(loc.x, loc.y)
        s.send(
            {
                "t": "button",
                "et": int(event_type),
                "btn": button_for_event_type(event_type),
                "nx": nx,
                "ny": ny,
                "flags": flags,
            }
        )
        return None

    if event_type == Quartz.kCGEventScrollWheel:
        dx = int(Quartz.CGEventGetIntegerValueField(event, Quartz.kCGScrollWheelEventDeltaAxis2))
        dy = int(Quartz.CGEventGetIntegerValueField(event, Quartz.kCGScrollWheelEventDeltaAxis1))
        s.send({"t": "scroll", "dx": dx, "dy": dy, "flags": flags})
        return None

    return event


def run_sender(target: str, port: int, secret: str):
    global STATE
    STATE = SenderState(target=target, port=port, secret=secret)
    print("[sender] ready")
    print("[sender] toggle hotkey: Control+Option+Command+R")
    print(f"[sender] target={target}:{port}")

    mask = (
        Quartz.CGEventMaskBit(Quartz.kCGEventKeyDown)
        | Quartz.CGEventMaskBit(Quartz.kCGEventKeyUp)
        | Quartz.CGEventMaskBit(Quartz.kCGEventFlagsChanged)
        | Quartz.CGEventMaskBit(Quartz.kCGEventMouseMoved)
        | Quartz.CGEventMaskBit(Quartz.kCGEventLeftMouseDown)
        | Quartz.CGEventMaskBit(Quartz.kCGEventLeftMouseUp)
        | Quartz.CGEventMaskBit(Quartz.kCGEventRightMouseDown)
        | Quartz.CGEventMaskBit(Quartz.kCGEventRightMouseUp)
        | Quartz.CGEventMaskBit(Quartz.kCGEventOtherMouseDown)
        | Quartz.CGEventMaskBit(Quartz.kCGEventOtherMouseUp)
        | Quartz.CGEventMaskBit(Quartz.kCGEventLeftMouseDragged)
        | Quartz.CGEventMaskBit(Quartz.kCGEventRightMouseDragged)
        | Quartz.CGEventMaskBit(Quartz.kCGEventOtherMouseDragged)
        | Quartz.CGEventMaskBit(Quartz.kCGEventScrollWheel)
    )

    tap = Quartz.CGEventTapCreate(
        Quartz.kCGHIDEventTap,
        Quartz.kCGHeadInsertEventTap,
        Quartz.kCGEventTapOptionDefault,
        mask,
        event_callback,
        None,
    )
    if tap is None:
        raise RuntimeError("Failed to create event tap. Check Accessibility permission.")

    run_loop_source = Quartz.CFMachPortCreateRunLoopSource(None, tap, 0)
    Quartz.CFRunLoopAddSource(Quartz.CFRunLoopGetCurrent(), run_loop_source, Quartz.kCFRunLoopCommonModes)
    Quartz.CGEventTapEnable(tap, True)
    Quartz.CFRunLoopRun()


def parse_args():
    p = argparse.ArgumentParser(description="MacBook sender for remote keyboard/mouse")
    p.add_argument("--target", required=True, help="Mac mini IP")
    p.add_argument("--port", type=int, default=5005, help="UDP port")
    p.add_argument("--secret", required=True, help="Shared secret")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_sender(args.target, args.port, args.secret)

