import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/Bar"
import SpotifyPopup from "./widget/Spotify"
import ControlCenter from "./widget/ControlCenter"

print("LOADING app.ts")

app.start({
  css: style,
  main() {
    app.get_monitors().map(Bar)
    SpotifyPopup()
    ControlCenter()
  },
})
