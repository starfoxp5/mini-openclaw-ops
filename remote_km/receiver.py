#!/usr/bin/env python3
import argparse
import socket
from typing import Tuple

import Quartz

from common import unpack_message


MODIFIER_MASK_FOR_KEYCODE = {
    55: Quartz.kCGEventFlagMaskCommand,
    54: Quartz.kCGEventFlagMaskCommand,
    56: Quartz.kCGEventFlagMaskShift,
    60: Quartz.kCGEventFlagMaskShift,
    58: Quartz.kCGEventFlagMaskAlternate,
    61: Quartz.kCGEventFlagMaskAlternate,
    59: Quartz.kCGEventFlagMaskControl,
    62: Quartz.kCGEventFlagMaskControl,
    57: Quartz.kCGEventFlagMaskAlphaShift,
}


def get_display_union_bounds() -> Tuple[float, float, float, float]:
    max_displays = 16
    err, display_ids, _ = Quartz.CGGetActiveDisplayList(max_displays, None, None)
    if err != Quartz.kCGErrorSuccess or not display_ids:
        b = Quartz.CGDisplayBounds(Quartz.CGMainDisplayID())
        return b.origin.x, b.origin.y, b.size.width, b.size.height

    min_x = float("inf")
    min_y = float("inf")
    max_x = float("-inf")
    max_y = float("-inf")
    for d in display_ids:
        b = Quartz.CGDisplayBounds(d)
        min_x = min(min_x, b.origin.x)
        min_y = min(min_y, b.origin.y)
        max_x = max(max_x, b.origin.x + b.size.width)
        max_y = max(max_y, b.origin.y + b.size.height)
    return min_x, min_y, max_x - min_x, max_y - min_y


def denormalize(nx: float, ny: float) -> Tuple[float, float]:
    x0, y0, w, h = get_display_union_bounds()
    nx = max(0.0, min(1.0, nx))
    ny = max(0.0, min(1.0, ny))
    return x0 + nx * w, y0 + ny * h


def post_event(ev):
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, ev)


def inject_key(msg):
    keycode = int(msg["keycode"])
    et = int(msg["et"])
    flags = int(msg.get("flags", 0))

    if et == Quartz.kCGEventFlagsChanged:
        mask = MODIFIER_MASK_FOR_KEYCODE.get(keycode)
        is_down = bool(flags & mask) if mask is not None else True
    else:
        is_down = et == Quartz.kCGEventKeyDown

    ev = Quartz.CGEventCreateKeyboardEvent(None, keycode, is_down)
    Quartz.CGEventSetFlags(ev, flags)
    post_event(ev)


def inject_move(msg):
    x, y = denormalize(float(msg["nx"]), float(msg["ny"]))
    ev = Quartz.CGEventCreateMouseEvent(
        None,
        Quartz.kCGEventMouseMoved,
        Quartz.CGPoint(x, y),
        Quartz.kCGMouseButtonLeft,
    )
    Quartz.CGEventSetFlags(ev, int(msg.get("flags", 0)))
    post_event(ev)


def inject_button(msg):
    et = int(msg["et"])
    x, y = denormalize(float(msg["nx"]), float(msg["ny"]))
    btn_name = msg.get("btn", "left")
    btn = {
        "left": Quartz.kCGMouseButtonLeft,
        "right": Quartz.kCGMouseButtonRight,
        "middle": Quartz.kCGMouseButtonCenter,
    }.get(btn_name, Quartz.kCGMouseButtonLeft)

    ev = Quartz.CGEventCreateMouseEvent(None, et, Quartz.CGPoint(x, y), btn)
    Quartz.CGEventSetFlags(ev, int(msg.get("flags", 0)))
    post_event(ev)


def inject_scroll(msg):
    dx = int(msg.get("dx", 0))
    dy = int(msg.get("dy", 0))
    ev = Quartz.CGEventCreateScrollWheelEvent(None, Quartz.kCGScrollEventUnitLine, 2, dy, dx)
    Quartz.CGEventSetFlags(ev, int(msg.get("flags", 0)))
    post_event(ev)


def run_receiver(bind: str, port: int, secret: str):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((bind, port))
    print(f"[receiver] listening on {bind}:{port}")

    while True:
        data, addr = sock.recvfrom(65535)
        try:
            msg = unpack_message(data, secret)
        except Exception:
            continue

        t = msg.get("t")
        try:
            if t == "key":
                inject_key(msg)
            elif t == "move":
                inject_move(msg)
            elif t == "button":
                inject_button(msg)
            elif t == "scroll":
                inject_scroll(msg)
        except Exception as e:
            print(f"[receiver] inject error from {addr}: {e}")


def parse_args():
    p = argparse.ArgumentParser(description="Mac mini receiver for remote keyboard/mouse")
    p.add_argument("--bind", default="0.0.0.0", help="Bind IP")
    p.add_argument("--port", type=int, default=5005, help="UDP port")
    p.add_argument("--secret", required=True, help="Shared secret")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_receiver(args.bind, args.port, args.secret)

