# Third-party assets

The playground (this demo app) bundles or loads a few third-party assets for
the OS-clone themes. They are NOT part of the published `@react-ui-os/*`
packages; the library itself ships no vendor artwork.

## Ubuntu wallpapers (CC-BY-SA 4.0)

`ubuntu-wallpaper*.png` are the Ubuntu 25.10 "Resolute Raccoon" wallpapers,
copyright (c) Canonical Ltd., from the official Ubuntu design resources
(https://design.ubuntu.com/resources). Used unmodified under the Creative
Commons Attribution-ShareAlike 4.0 licence
(https://creativecommons.org/licenses/by-sa/4.0/).

## Ubuntu Yaru app icons (CC-BY-SA 4.0)

`yaru/*.png` are Yaru app icons, and `yaru/show-apps.svg` is the Yaru
Show Applications glyph (`start-here-symbolic`), copyright (c) Canonical Ltd.
and the Yaru contributors, from https://github.com/ubuntu/yaru. Used unmodified
under the Creative Commons Attribution-ShareAlike 4.0 licence
(https://creativecommons.org/licenses/by-sa/4.0/). Any modified copies must
remain under CC-BY-SA 4.0.

## Ubuntu font (Ubuntu Font Licence)

The Ubuntu theme requests the Ubuntu typeface; the playground loads it from
Google Fonts (https://fonts.google.com/specimen/Ubuntu), licensed under the
Ubuntu Font Licence 1.0 (https://ubuntu.com/legal/font-licence). The font files
are not bundled in this repository.

## Microsoft Fluent UI System Icons (MIT)

The example apps' Windows icon variants and the Settings / Recents window icons
derive from Microsoft Fluent UI System Icons
(https://github.com/microsoft/fluentui-system-icons), copyright (c) Microsoft
Corporation, MIT License. These ship in the `@react-ui-os/example-apps` and
`@react-ui-os/desktop` packages; per-file attribution is in `fluent-icons.tsx`,
`system-icons.tsx`, and `RecentsIcon.tsx`. The default Settings gear is from
Lucide (https://lucide.dev), ISC License.

## Windows 11 app icons (third-party pack, demo only)

`win11/*.png` are individual icons cropped from the "Windows 11 Icon Pack (32px
& 22px)" by Samliu (copyright (c) 2024 Samliu), used for the Windows theme's app
icons in this demo. This is a third-party icon pack with **no stated open-source
license**; it is bundled here only for visual fidelity and is not part of the
published packages (which ship the MIT Fluent System Icons above). The depicted
Windows app icon designs and "Windows" are the property of Microsoft
Corporation. Confirm the pack's redistribution terms before reusing these files
or shipping them anywhere public.

## Trademarks

"Ubuntu" and the Circle of Friends logo are trademarks of Canonical Ltd.;
"Windows" and the four-pane logo are trademarks of Microsoft Corporation;
"macOS" is a trademark of Apple Inc. The launcher glyphs and window controls in
this library are our own original drawings, used for OS-clone fidelity rather
than reproduced from vendor files. The macOS and Windows wallpapers in this demo
are placeholders.
