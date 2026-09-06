import Bars from "./Bars"
import SpotifyPopup from "./Spotify"
import ControlCenter from "./ControlCenter"
import CommandPalette from "./CommandPalette"

export default function Shell() {
  Bars()
  SpotifyPopup()
  ControlCenter()
  CommandPalette()
}
