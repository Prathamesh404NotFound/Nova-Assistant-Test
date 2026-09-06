# Nova Sprite Artwork — License & Attribution

## Origin

The active PNG sprite set is a deterministic derivative of the user-provided reference
image `src/assets/nova/nova-reference.jpg`, using crop, resize, brightness, saturation,
and contrast adjustments. The image's original creator/license was not supplied in the
project artifacts, so these derivative files should not be redistributed outside the
user's authorized project until provenance is confirmed.

The existing SVG sprite set below remains original project artwork.

## Covered files

- `nova-idle.svg`
- `nova-listening.svg`
- `nova-thinking.svg`
- `nova-speaking.svg`
- `nova-happy.svg`
- `nova-excited.svg`
- `nova-curious.svg`
- `nova-focused.svg`
- `nova-confident.svg`
- `nova-gentle.svg`
- `nova-alert.svg`
- `nova-sleepy.svg`
- `nova-processing.svg`
- `nova-error.svg`

The active derived files are the matching `nova-*.png` files plus `nova-reference.jpg`.

## License

The original SVG assets inherit the project's existing licensing. The derived PNG files
inherit the source image's permissions and must be treated as user-provided material.

## Design notes

All 14 sprites share an identical base geometry (robot head shell, antenna, side audio
ports, eye and mouth placement) so they read as the same character, "Nova", across every
state. Only expression, eye shape, mouth shape, and accent color vary per state.
