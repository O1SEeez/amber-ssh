!macro customInstall
  FileOpen $0 "$INSTDIR\resources\amber-install-mode" w
  FileWrite $0 "nsis"
  FileClose $0
!macroend
