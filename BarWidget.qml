import QtQuick
import qs.Commons
import qs.Ui

// Bar button for the ninjas: click for the dojo roster, right-click to
// hide or show them all.
BarWidget {
  id: root
  moduleName: "yaghofgm.critters"

  readonly property var service: bar && bar.shell ? bar.shell.serviceFor("yaghofgm.critters") : null
  // Re-read the live world every couple of seconds while the popup is open.
  property int pulse: 0
  readonly property int version: (service ? service.rosterVersion : 0) + pulse
  readonly property var roster: version >= 0 && service ? service.critterList() : []
  readonly property var dojo: version >= 0 && service ? service.dojoInfo() : ({ exists: false, text: "" })
  readonly property string tourney: version >= 0 && service ? service.tournamentInfo() : ""
  readonly property var mind: version >= 0 && service ? service.mindInfo() : ({ text: "", enabled: true, allowCpu: false })
  readonly property var fights: version >= 0 && service ? service.fightLog() : []
  readonly property bool hiddenAll: version >= 0 && service ? service.world.hidden : false
  readonly property string homeState: version >= 0 && service ? (service.world.homeState || "") : ""
  readonly property color fg: bar ? bar.foreground : Color.foreground
  readonly property string family: bar ? bar.fontFamily : Style.font.family

  property bool popupOpen: false
  property string moveNote: ""
  readonly property bool opened: popupOpen
  function open() { popupOpen = true }
  function close() { popupOpen = false }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  Timer {
    interval: 2000
    repeat: true
    running: root.popupOpen
    onTriggered: root.pulse++
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: ""
    active: root.roster.length > 0 && !root.hiddenAll
    tooltipText: root.popupOpen ? "" : (root.homeState === "packed" ? "Ninjas are home (right-click to call them back)" : root.hiddenAll ? "Ninjas paused (right-click to resume)"
      : (root.roster.length ? root.roster.length + " ninja" + (root.roster.length > 1 ? "s" : "") + " · right-click to pause" : "Ninjas"))

    onPressed: function(b) {
      if (!root.service) return
      if (b === Qt.RightButton) root.service.setHidden(!root.service.world.hidden)
      else root.popupOpen = !root.popupOpen
    }
  }

  PopupCard {
    id: popup
    anchorItem: button
    bar: root.bar
    owner: root
    open: root.popupOpen
    contentWidth: popup.fittedContentWidth(Style.space(380))
    contentHeight: popup.fittedContentHeight(column.implicitHeight)

    Column {
      id: column
      anchors.fill: parent
      spacing: Style.space(8)

      Text {
        text: "Dojo"
        color: root.fg
        font.family: root.family
        font.pixelSize: Style.font.subtitle
        font.bold: true
      }

      Column {
        width: parent.width
        spacing: Style.space(4)

        Text {
          width: parent.width
          wrapMode: Text.WordWrap
          text: root.dojo.text
          color: root.fg
          font.family: root.family
          font.pixelSize: Style.font.bodySmall
        }

        // Overall construction progress.
        Rectangle {
          visible: root.dojo.exists === true
          width: parent.width
          height: Style.space(6)
          radius: height / 2
          color: Qt.rgba(root.fg.r, root.fg.g, root.fg.b, 0.15)

          Rectangle {
            width: parent.width * Math.min(1, (root.dojo.stage || 0) / Math.max(1, root.dojo.total || 1))
            height: parent.height
            radius: parent.radius
            color: Color.accent
          }
        }

        Text {
          visible: root.fights.length > 0
          width: parent.width
          wrapMode: Text.WordWrap
          text: "Recent fights (winner's odds):\n" + root.fights.join("\n")
          color: Qt.darker(root.fg, 1.25)
          font.family: root.family
          font.pixelSize: Style.font.caption
        }

        Text {
          visible: root.moveNote !== ""
          width: parent.width
          wrapMode: Text.WordWrap
          text: "Can't move the dojo: " + root.moveNote + "."
          color: Color.urgent
          font.family: root.family
          font.pixelSize: Style.font.caption
        }

        Text {
          width: parent.width
          wrapMode: Text.WordWrap
          text: root.tourney
          color: Qt.darker(root.fg, 1.4)
          font.family: root.family
          font.pixelSize: Style.font.caption
        }
      }

      Text {
        width: parent.width
        wrapMode: Text.WordWrap
        text: root.mind.text
        color: root.mind.on ? Color.accent : Qt.darker(root.fg, 1.4)
        font.family: root.family
        font.pixelSize: Style.font.caption
      }

      PanelSeparator { foreground: root.fg }

      Text {
        visible: root.roster.length === 0
        width: parent.width
        wrapMode: Text.WordWrap
        text: "No ninjas yet. Invite one: they appear in the window you have focused. Drag to throw them, right-click one to hear their stats, strike the gong for a tournament."
        color: Qt.darker(root.fg, 1.4)
        font.family: root.family
        font.pixelSize: Style.font.caption
      }

      Repeater {
        model: root.roster

        Item {
          id: row
          required property var modelData
          width: column.width
          height: Math.max(rowText.implicitHeight, actions.implicitHeight)

          // Headband swatch, with the belt underneath.
          Column {
            id: swatch
            anchors.left: parent.left
            anchors.verticalCenter: parent.verticalCenter
            width: Style.space(22)
            spacing: Style.space(2)

            Rectangle {
              width: Style.space(14)
              height: Style.space(5)
              radius: 2
              color: row.modelData.band
            }
            Rectangle {
              width: Style.space(14)
              height: Style.space(4)
              radius: 2
              color: row.modelData.beltColor
              border.width: 1
              border.color: Qt.rgba(0, 0, 0, 0.4)

              Rectangle {
                visible: row.modelData.beltStripe !== ""
                anchors.centerIn: parent
                width: parent.width / 3
                height: parent.height - 2
                color: row.modelData.beltStripe || "transparent"
              }
            }
          }

          Column {
            id: rowText
            anchors.left: swatch.right
            anchors.right: actions.left
            anchors.rightMargin: Style.space(6)
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(1)

            Text {
              width: parent.width
              elide: Text.ElideRight
              text: (row.modelData.master ? "Sensei " : "") + row.modelData.name
              color: row.modelData.master ? "#f2c14e" : root.fg
              font.family: root.family
              font.pixelSize: Style.font.bodySmall
              font.bold: true
            }
            Text {
              width: parent.width
              elide: Text.ElideRight
              text: row.modelData.detail
              color: Qt.darker(root.fg, 1.5)
              font.family: root.family
              font.pixelSize: Style.font.caption
            }
          }

          Row {
            id: actions
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(2)

            Button {
              iconText: ""
              tooltipText: "Bring to focused window"
              foreground: root.fg
              onClicked: root.service.summon(row.modelData.id)
            }
            Button {
              iconText: ""
              tooltipText: "Send home"
              foreground: root.fg
              onClicked: root.service.remove(row.modelData.id)
            }
          }
        }
      }

      PanelSeparator { foreground: root.fg }

      Row {
        spacing: Style.space(6)
        anchors.horizontalCenter: parent.horizontalCenter

        Button {
          iconText: ""
          text: "Invite ninja"
          bordered: true
          foreground: root.fg
          onClicked: root.service.spawn("ninja")
        }
        Button {
          text: "Move dojo here"
          tooltipText: "Move the dojo, and every ninja, to the window you were last working in"
          bordered: true
          foreground: root.fg
          enabled: root.dojo.exists === true
          opacity: enabled ? 1 : 0.4
          onClicked: {
            var r = root.service.moveDojoHere()
            if (r !== "ok") root.moveNote = r
            else root.moveNote = ""
          }
        }
      }

      Row {
        spacing: Style.space(6)
        anchors.horizontalCenter: parent.horizontalCenter

        Button {
          text: "Summon demons"
          bordered: true
          foreground: root.fg
          enabled: root.roster.length >= 1
          opacity: enabled ? 1 : 0.4
          onClicked: root.service.raid()
        }
        Button {
          text: "Hold tournament"
          bordered: true
          foreground: root.fg
          enabled: root.roster.length >= 2
          opacity: enabled ? 1 : 0.4
          onClicked: root.service.tournament()
        }
      }

      Row {
        spacing: Style.space(6)
        anchors.horizontalCenter: parent.horizontalCenter

        Button {
          text: root.homeState === "packed" ? "📣 Call them back" : (root.hiddenAll ? "▶ Resume" : "⏸ Pause")
          tooltipText: "Pause stops everything and frees the GPU (also: right-click the bar icon)"
          bordered: true
          foreground: root.fg
          onClicked: root.service.setHidden(!root.hiddenAll)
        }
        Button {
          visible: !root.hiddenAll
          text: root.homeState === "gathering" || root.homeState === "packing" ? "↩ Come back!" : (root.homeState ? "…" : "🏯 Send home")
          tooltipText: "Everyone walks into the dojo, the dojo folds away, and everything pauses. Nothing is forgotten."
          bordered: true
          foreground: root.fg
          enabled: root.homeState === "" || root.homeState === "gathering" || root.homeState === "packing"
          onClicked: root.service.sendHome()
        }
        Button {
          text: "Smaller"
          foreground: root.fg
          onClicked: root.service.setSize(root.service.world.size - 0.2)
        }
        Button {
          text: "Bigger"
          foreground: root.fg
          onClicked: root.service.setSize(root.service.world.size + 0.2)
        }
        Button {
          text: root.service && root.service.world.followFocus ? "Follow me: on" : "Follow me: off"
          tooltipText: "Ninjas drift to the window you're working in"
          foreground: root.fg
          onClicked: root.service.setFollow(!root.service.world.followFocus)
        }
      }

      Row {
        spacing: Style.space(6)
        anchors.horizontalCenter: parent.horizontalCenter

        Button {
          text: root.mind.enabled ? "Minds: on" : "Minds: off"
          foreground: root.fg
          onClicked: root.service.setMindEnabled(!root.mind.enabled)
        }
        Button {
          text: "Thinking: " + (root.mind.budget === "high" ? "high" : (root.mind.budget === "normal" ? "normal" : "low"))
          tooltipText: "How often the minds think. Low: a burst every 5 min. Normal: every 90 s. High: continuously (model stays loaded, ~+50-100 W on the eGPU)."
          foreground: root.fg
          onClicked: root.service.cycleMindBudget()
        }
        Button {
          text: root.mind.allowCpu ? "CPU: allowed" : "CPU: no"
          tooltipText: "Let minds run on a CPU-only Ollama (slow, ~9s of full CPU per thought)"
          foreground: root.fg
          onClicked: root.service.setMindAllowCpu(!root.mind.allowCpu)
        }
      }
    }
  }
}
