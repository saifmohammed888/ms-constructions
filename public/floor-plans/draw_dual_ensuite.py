#!/usr/bin/env python3
"""Draw a dual-ensuite typical-floor plan as PNG (18 px per foot)."""

from PIL import Image, ImageDraw, ImageFont

SCALE = 18  # px per foot
MARGIN_L, MARGIN_T = 90, 110
BAL_W, BLDG_W, BLDG_D = 6, 30, 40
SET_N, SET_E, SET_S = 1.5, 1.5, 1.0

W = MARGIN_L + int((BAL_W + BLDG_W + SET_E + 6) * SCALE)
H = MARGIN_T + int((SET_N + BLDG_D + SET_S + 14) * SCALE)

img = Image.new("RGB", (W, H), "#f7f5f1")
d = ImageDraw.Draw(img)

try:
    font_title = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
    font_sm = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 12)
    font_b = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 15)
except OSError:
    font_title = font = font_sm = font_b = ImageFont.load_default()

RED = "#c31b1b"
TEAL = "#2a6f8f"
WALL = "#111111"
GREEN = "#c5d4b8"


def ft(x, y):
    """Building-relative feet -> px. Origin = NW corner of building."""
    ox = MARGIN_L + BAL_W * SCALE
    oy = MARGIN_T + SET_N * SCALE
    return ox + x * SCALE, oy + y * SCALE


def rect_ft(xyxy, fill="#ffffff", outline=WALL, width=4):
    x1, y1, x2, y2 = xyxy
    p1 = ft(x1, y1)
    p2 = ft(x2, y2)
    d.rectangle([p1, p2], fill=fill, outline=outline, width=width)


def hatch_rect(x1, y1, x2, y2):
    p1 = ft(x1, y1)
    p2 = ft(x2, y2)
    d.rectangle([p1, p2], fill="#e6e6e6", outline="#888888", width=2)
    x0, y0 = int(p1[0]), int(p1[1])
    x1p, y1p = int(p2[0]), int(p2[1])
    step = 8
    for i in range(- (y1p - y0), x1p - x0, step):
        d.line([(x0 + i, y0), (x0 + i + (y1p - y0), y1p)], fill="#b0b0b0", width=1)


def label(text, x, y, f=None, fill=RED, anchor="mm"):
    px, py = ft(x, y)
    d.text((px, py), text, font=f or font, fill=fill, anchor=anchor)


def furn_rect(x1, y1, x2, y2):
    p1 = ft(x1, y1)
    p2 = ft(x2, y2)
    d.rectangle([p1, p2], outline=TEAL, width=2)


def door_arc(cx, cy, r, start, end):
    # approximate swing as a quarter pie outline
    box = [ft(cx - r, cy - r), ft(cx + r, cy + r)]
    d.arc(box, start=start, end=end, fill=WALL, width=2)


# Title
d.text((W // 2, 28), "DUAL ENSUITE  |  BOTH BEDROOMS HAVE ATTACHED TOILETS", font=font_title, fill=RED, anchor="mt")
d.text((W // 2, 56), "Same 30'-0\" x 40'-0\" typical floor   |   two south balconies kept   |   no common hall toilet", font=font_sm, fill=RED, anchor="mt")

# Dimension lines
bx0, by0 = ft(0, 0)
d.line([(MARGIN_L, MARGIN_T - 28), (bx0, MARGIN_T - 28)], fill=RED, width=1)
d.text(((MARGIN_L + bx0) / 2, MARGIN_T - 34), "6'-0\"", font=font_b, fill=RED, anchor="ms")
d.line([(bx0, MARGIN_T - 28), (ft(30, 0)[0], MARGIN_T - 28)], fill=RED, width=1)
d.text(((bx0 + ft(30, 0)[0]) / 2, MARGIN_T - 34), "30'-0\"", font=font_b, fill=RED, anchor="ms")
rx = ft(30 + SET_E + 1.2, 20)[0]
d.line([(rx, ft(0, 0)[1]), (rx, ft(0, 40)[1])], fill=RED, width=1)
d.text((rx + 8, (ft(0, 0)[1] + ft(0, 40)[1]) / 2), "40'-0\"", font=font_b, fill=RED, anchor="mm")

# Setbacks
rect_ft((-0.02, -SET_N, 30 + SET_E, 0), fill=GREEN, outline="#6f8a5e", width=1)
rect_ft((30, 0, 30 + SET_E, 40), fill=GREEN, outline="#6f8a5e", width=1)
label("1'-6\"", 15, -0.75, font_sm)
label("1'-6\"", 30.75, 20, font_sm)

# West balcony
hatch_rect(-6, 0, 0, 39.5)
label("BAL 6' x 39'-6\"", -3, 20, font, RED)
# rotate-ish: draw vertical text by characters
d.rectangle([ft(-6, 0), ft(0, 39.5)], outline="#888", width=1)

# Building outer wall
rect_ft((0, 0, 30, 40), fill="#ffffff", outline=WALL, width=6)

# --- rooms (feet from NW of building) ---
# Stair 10 x 8
rect_ft((0, 0, 10, 8), fill=None, outline=WALL, width=3)
for i in range(8):
    y = 0.4 + i * 0.9
    d.line([ft(0.4, y), ft(9.2, y)], fill="#444", width=1)
label("STAIR", 5, 3.2, font_sm)
label("DN / UP", 5, 4.5, font_sm)

# Lobby 5 x 8
rect_ft((10, 0, 15, 8), fill=None, outline=WALL, width=3)
label("LOBBY", 12.5, 3.5)
label("5' x 8'", 12.5, 4.6, font_sm)
door_arc(15, 8, 2.2, 180, 270)

# Lift
rect_ft((15, 0, 20.4, 8), fill=None, outline=WALL, width=3)
furn_rect(16.2, 1.5, 19.2, 5.5)
label("LIFT", 17.7, 6.2, font_sm)
label("5'-4\" x 5'-4\"", 17.7, 7.1, font_sm)

# Utility
rect_ft((20.4, 0, 30, 8), fill=None, outline=WALL, width=3)
furn_rect(21.2, 1.2, 24, 2.8)
furn_rect(25, 1.2, 29, 6.5)
label("UTILITY", 25.2, 4.2, font_sm)
label("6'-2\" x 5'-10\"", 25.2, 5.3, font_sm)

# Kitchen 11.5 x 8 under lift/utility
rect_ft((18, 8, 30, 16), fill=None, outline=WALL, width=3)
furn_rect(18.6, 8.6, 29.2, 10.2)
furn_rect(28.2, 10.2, 29.4, 15.2)
label("KITCHEN", 24, 12.2)
label("11'-6\" x 8'", 24, 13.3, font_sm)

# Living / dining
label("LIVING + DINING", 9, 12.5)
label("15'-6\" x 14'-0\"", 9, 13.6, font_sm)
furn_rect(1.2, 9.5, 2.8, 15.5)  # sofa west
furn_rect(3.2, 11.5, 7, 13.5)  # table
furn_rect(1.2, 16.5, 8, 18)  # sofa south
furn_rect(10.5, 10, 15.5, 13.2)  # dining
# chairs
for cx, cy in [(11, 10.4), (14.8, 10.4), (11, 12.8), (14.8, 12.8)]:
    p = ft(cx, cy)
    d.ellipse([p[0] - 6, p[1] - 6, p[0] + 6, p[1] + 6], outline=TEAL, width=2)

# openings to west balcony (living)
d.line([ft(0, 10), ft(0, 14.5)], fill="#ffffff", width=10)
d.line([ft(0, 17), ft(0, 20)], fill="#ffffff", width=10)

# MASTER ATTACHED TOILET — relocated north of master (was dining)
rect_ft((18, 16, 30, 24), fill="#fff7f2", outline=WALL, width=4)
label("MASTER ATTACHED TOILET", 24, 18.2)
label("(relocated from centre stack)", 24, 19.3, font_sm)
label("8'-0\" x 8'-0\"", 24, 20.4, font_sm)
# wc
p = ft(19.5, 21.5)
d.ellipse([p[0] - 10, p[1] - 14, p[0] + 10, p[1] + 14], outline=TEAL, width=2)
furn_rect(21, 17.2, 23, 18.6)  # basin
furn_rect(25, 17.2, 29.2, 22.5)  # shower
label("SHWR", 27.1, 20, font_sm)
# door FROM master (south)
door_arc(20.5, 24, 2.4, 270, 360)
label("DOOR FROM MASTER", 22.2, 23.2, font_sm)

# Passage note
label("PASSAGE — no hall toilet", 15.5, 21.8, font_sm)

# Bedroom 1 (left)
rect_ft((0, 24, 13, 37.5), fill=None, outline=WALL, width=4)
label("BEDROOM 1", 5.5, 33.8)
label("11'-0\" x 12'-0\"", 5.5, 34.9, font_sm)
furn_rect(1.2, 26.2, 7.2, 30.2)  # bed
furn_rect(1.2, 31.0, 6.5, 32.2)
d.line([ft(0, 26), ft(0, 31)], fill="#ffffff", width=10)  # to west balcony
# entry from living
door_arc(3.5, 24, 2.2, 0, 90)

# Bedroom 1 attached toilet on east of room
rect_ft((8, 24, 13, 32), fill="#fff7f2", outline=WALL, width=4)
label("ATTACHED", 10.5, 26.2, font_sm)
label("TOILET 1", 10.5, 27.2, font_sm)
label("5' x 8'", 10.5, 28.2, font_sm)
p = ft(9.3, 30.2)
d.ellipse([p[0] - 8, p[1] - 12, p[0] + 8, p[1] + 12], outline=TEAL, width=2)
furn_rect(10.6, 24.6, 12.4, 27.4)
# door FROM bedroom 1 (west side of toilet)
door_arc(8, 28, 2.0, 270, 360)
label("FROM BR1", 6.6, 29.6, font_sm)

# Close the old centre corridor: plumbing shaft, not a hall
rect_ft((13, 32, 16, 37.5), fill="#eeeeee", outline=WALL, width=3)
label("SHAFT", 14.5, 35, font_sm)

# Bedroom 2 / master
rect_ft((16, 24, 30, 37.5), fill=None, outline=WALL, width=4)
label("BEDROOM 2 / MASTER", 23.2, 33.8)
label("11'-0\" x 12'-0\"", 23.2, 34.9, font_sm)
furn_rect(20.5, 26.5, 27.5, 30.8)
furn_rect(17, 25.5, 18.3, 32.5)  # wardrobe
door_arc(18.5, 24, 2.2, 0, 90)

# South balconies
hatch_rect(0, 37.5, 13, 40)
hatch_rect(16, 37.5, 30, 40)
label("BAL 11'-0\" x 2'-6\"", 6.5, 38.8, font_sm)
label("BAL 14'-0\" x 2'-6\"", 23, 38.8, font_sm)
d.line([ft(3, 37.5), ft(10, 37.5)], fill="#ffffff", width=8)
d.line([ft(19, 37.5), ft(27, 37.5)], fill="#ffffff", width=8)

# Road
label("1'-0\"   ... ROAD ...", 15, 41.2)

# Notes
notes_y = ft(0, 43.2)[1]
notes = [
    "What changed vs your original drawing:",
    "1. Original toilets were stacked in the centre and opened to the passage (common baths).",
    "2. Bedroom 1 toilet is now INSIDE that room (east side). Door from Bedroom 1. Keeps west balcony + south balcony.",
    "3. Second toilet is MOVED NORTH under the kitchen (old dining strip), aligned on the east wall. Door from Master.",
    "4. Dining is a table in the living. Middle passage has no toilet.",
    "5. Both south balconies stay. Wet wall can still share the old plumbing shaft.",
    "Concept only — not a construction / structural drawing.",
]
x = MARGIN_L
for i, line in enumerate(notes):
    d.text((x, notes_y + i * 22), line, font=font if i else font_b, fill="#111111")

out = "/Users/mohammedsaif/Documents/MS/ms-constructions/public/floor-plans/dual-ensuite-both-rooms.png"
img.save(out, "PNG")
print(out)
