# Pear TV

YouTube Music on a Samsung TV through [TizenBrew](https://github.com/reisxd/TizenBrew), with Samsung remote control support.

This is a TV conversion of [Pear Desktop](https://github.com/pear-devs/pear-desktop) with all of its plugins removed. Pear Desktop is an Electron app that loads `music.youtube.com` in a window. On the TV, TizenBrew loads the site and injects `userScript.js`, which adds remote navigation and media key handling. The player controls follow the approach in Pear Desktop's renderer: the `#movie_player` API and the player-bar buttons.

## Remote controls

| Remote button | Action |
| --- | --- |
| Arrows | Move the focus ring to the nearest item in that direction |
| Enter / OK | Open or press the focused item |
| Back | Close a menu, then close the full-screen player, then go back a page. On the home page it is passed to TizenBrew. |
| Play/Pause | Toggle playback |
| Play / Pause / Stop | Play, or pause |
| Fast-forward / Rewind | Seek 10 seconds |
| Next / Previous track, Channel Up / Down | Next or previous song |

When the search box is focused, Left, Right and Enter go to the text field so the TV keyboard works. Up and Down leave it.

## Install

1. Install TizenBrew on the TV by following the instructions in its repository. The TV must be in Developer Mode.
2. Publish this folder where TizenBrew can fetch it: an npm package, or a GitHub repository.
3. In TizenBrew, add the module by its npm package name or GitHub path, then open "Pear TV".

`package.json` declares the module to TizenBrew: `packageType` is `mods`, `websiteURL` is YouTube Music, `main` is the injected script, and `keys` lists the remote keys TizenBrew registers. The script also registers them itself if `tizen.tvinputdevice` is available.

## Known limits

- It has not been tested on a TV yet, only in a desktop browser with the remote keys simulated.
- Pear Desktop overrides the browser's user agent so YouTube Music treats it as desktop Chrome. A userscript cannot change the user agent the server sees, so YouTube Music may treat the TV browser differently, or refuse it.
- Google sign-in may refuse the TV's built-in browser.
- None of Pear Desktop's plugins are included, so there is no ad blocking, lyrics, downloads or themes.
- With long lists, reaching the player bar at the bottom takes many presses. The media keys control playback from anywhere.

## Testing in a desktop browser

Paste `userScript.js` into the developer console on `music.youtube.com`. The arrow keys and Enter work as on the remote, and Escape stands in for Back.

## License

MIT. See `LICENSE`.
