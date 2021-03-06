import {Network} from './network.js'

import {Button, Input, Grid, Label, DatabaseGrid, Dialog} from './ui.js'

import {
  NewDeviceWizzard, PublishDevicesSettingsWizzard, EditDeviceWizzard, DeleteDeviceWizzard,
  NewHAPInstanceWizzard, DeleteHapInstanceWizzard, EditHapInstanceWizzard,
  NewObjectWizzard, EditObjectWizzard, DeleteVariableWizzard,
  RebootUpdateDialog, DeactivateInstanceWizzard, DeleteProgramWizzard,
  InvalidCredentialsDialog, SettingsDialog
} from './wizzards.js'

import {WelcomeWizzard} from './welcomewizzard.js'

import {Localization} from './localization.js'

export class Application {
  constructor () {
    // extract SID from the index url

    var queryString = window.location.search
    // prevent a bug
    if (queryString.startsWith('?')) {
      queryString = queryString.replace('?', '')
    }
    const urlParams = new URLSearchParams(queryString)
    this.sid = urlParams.get('sid')
    let network = new Network(this.sid)
    this.makeApiRequest = network.makeApiRequest
  }

  userFriendlySeconds (seconds) {
    if (seconds < 50) {
      return this.__('less that 1 minute')
    }
    if (seconds < 3600) {
      return this.__('%s min', Math.round((seconds / 60)))
    }
    if (seconds < 86400) {
      let hr = Math.round((seconds / 60 / 60))
      return (hr === 1) ? this.__('%s hour', hr) : this.__('%s hours', hr)
    }
    let d = Math.floor((seconds / 60 / 60 / 24))
    return (d === 1) ? this.__('%s day', d) : this.__('%s days', d)
  }

  async buildOverview () {
    let self = this
    let oOv = $('#deviceOverview')
    oOv.empty()

    oOv.append(this.__('%s mapped device(s)', this.deviceList.length))
    oOv.append('<br /><br />')
    if (this.variableList) {
      oOv.append(this.__('%s mapped variable(s)', this.variableList.length))
      oOv.append('<br /><br />')
    }
    if (this.programList) {
      oOv.append(this.__('%s mapped program(s)', this.programList.length))
    }
    let bOv = $('#bridgeOverview')
    bOv.empty()
    bOv.append(this.__('%s running HAP instances', this.bridges.length)).append('<br />')
    this.bridges.map(bridge => {
      bOv.append(bridge.displayName + ' (' + bridge.pincode + ')').append('<br />')
    })

    bOv.niceScroll()

    if (!this.systemInfo) {
      this.systemInfo = await this.makeApiRequest({method: 'system'})
    }

    let numCores = this.systemInfo.cpu.length
    let coreInfo = this.systemInfo.cpu[0].model || 'unknown cpu'
    let mem = (parseInt(this.systemInfo.mem) / 1000000).toFixed(2)

    let sOv = $('#sysOverview')
    sOv.empty()
    sOv.append(this.__('%s cores %s', numCores, coreInfo)).append('<br />')
    sOv.append(this.__('%s MB free memory', mem)).append('<br />').append('<br />')
    sOv.append(this.__('CCU Uptime %s', this.userFriendlySeconds(this.systemInfo.uptime))).append('<br />')
    sOv.append(this.__('HAP Uptime %s', this.userFriendlySeconds(this.systemInfo.hapuptime))).append('<br />').append('<br />')
    sOv.append(this.__('Version %s', this.systemInfo.version)).append('<br />')
    if (this.systemInfo.version !== this.systemInfo.update) {
      let update = $('<button>').attr('type', 'button').addClass('btn btn-info').append(this.__('update to %s', this.systemInfo.update))
      sOv.append(update)
      update.bind('click', async () => {
        self.updateDialog = new RebootUpdateDialog(this)
        self.updateDialog.setProceed(async () => {
          await this.makeApiRequest({method: 'update'})
          setTimeout(() => {
            self.waitForReboot()
          }, 30000)
        })

        let chlog = await self.makeApiRequest({method: 'updateChangelog'}, 'text')
        let converter = new showdown.Converter()
        self.updateDialog.setProceedLabel(self.__('Update HAP Plugin'))
        self.updateDialog.run(converter.makeHtml(chlog))
      })
      update.attr('style', 'cursor:pointer')
    }

    this.debugMode = ((self.systemInfo.debug === true) || (self.systemInfo.debug === 'true'))
    $('#lbl_btn_debug').html(this.debugMode ? this.__('Disable Debug') : this.__('Enable Debug'))

    clearTimeout(this.updateTimer)
    this.updateTimer = setTimeout(async () => {
      self.systemInfo = await this.makeApiRequest({method: 'system'})
      self.buildOverview()
    }, 90000)
  }

  buildDeviceList () {
    let self = this
    $('#containerTitle').html(self.__('Devices'))
    let deviceContainer = $('#container')
    let containerFooter = $('#container_footer')

    deviceContainer.empty()

    let grid = new DatabaseGrid('deviceList', this.deviceList, {})

    grid.setTitleLabels([self.__('Address'), self.__('Homekit name'), self.__('Service'), self.__('Instance')])
    grid.setColumns([
      {sz: {sm: 6, md: 2, lg: 2, xl: 2}, sort: 0},
      {sz: {sm: 6, md: 2, lg: 2, xl: 2}, sort: 1},
      {sz: {sm: 6, md: 2, lg: 2, xl: 3}, sort: 2},
      {sz: {sm: 6, md: 2, lg: 2, xl: 2}, sort: 3},
      {sz: {sm: 6, md: 2, lg: 2, xl: 2}},
      {sz: {sm: 6, md: 2, lg: 2, xl: 1}}
    ])
    grid.addSearchBar(self.__('Search'), self.__('Clear'), (element, filter) => {
      return (((element.name) && (element.name.toLowerCase().indexOf(filter.toLowerCase()) > -1)) ||
      ((element.serial) && (element.serial.toLowerCase().indexOf(filter.toLowerCase()) > -1)))
    })

    grid.sortCallback = (column, a, b) => {
      switch (column) {
        case 0:
          return (a.serial + ':' + a.channel).localeCompare(b.serial + ':' + b.channel)
        case 1:
          return a.name.localeCompare(b.name)
        case 2:
          return a.serviceClass.localeCompare(b.serviceClass)
        case 3:
          let ba = this.getBridgeWithId(a.instanceID)
          let bb = this.getBridgeWithId(b.instanceID)
          return (ba.displayName).localeCompare(bb.displayName)
        default:
          return true
      }
    }

    grid.columnSort = 0

    grid.setRenderer((row, item) => {
      let editButton = new Button('success', self.__('Edit'), (e, btn) => {
        new EditDeviceWizzard(this).run(item)
      }, true)

      let deleteButton = new Button('danger', self.__('Delete'), (e, btn) => {
        new DeleteDeviceWizzard(this).run(item)
      }, true)

      let badgeState = (item.isPublished === true) ? 'badge-success' : 'badge-secondary'
      let bridge = self.getBridgeWithId(item.instanceID)

      return ([
        item.serial + ':' + item.channel,
        item.name,
        item.serviceClass,
        $('<span>').attr('class', 'badge ' + badgeState).append(bridge.displayName),

        editButton.render(),
        deleteButton.render()])
    })

    deviceContainer.append(grid.render())

    let newButton = new Button('primary', self.__('New'), async (e, btn) => {
      let mapDevices = await this.makeApiRequest({method: 'newDevice'})
      new NewDeviceWizzard(this).run(mapDevices.devices)
    })
    newButton.setStyle('float:right')
    containerFooter.empty()
    containerFooter.append(newButton.render())
  }

  getDeviceList () {
    return this.deviceList || []
  }

  getBridges () {
    return this.bridges || []
  }

  getRooms () {
    return this.roomList || []
  }

  getBridgeWithId (id) {
    return this.getBridges().filter(bridge => bridge.id === id)[0] || undefined
  }

  getServiceByAddress (chAddress) {
    return this.getDeviceList().filter(device => device.serial + ':' + device.channel === chAddress)[0] || undefined
  }

  getRoombyId (roomID) {
    return this.getRooms().filter(room => room.id === roomID)[0] || undefined
  }

  getRoombyChannelId (channelID) {
    return this.getRooms().filter(room => (room.channels.indexOf(channelID) > -1))[0] || undefined
  }

  getVariableBySerial (varSerial) {
    return this.variableList.filter(variable => variable.serial === varSerial)[0] || undefined
  }

  getProgramBySerial (progSerial) {
    return this.programList.filter(program => program.serial === progSerial)[0] || undefined
  }

  getHapInstanceByRoomId (roomId) {
    return this.bridges.filter(bridge => bridge.roomId === roomId)[0] || undefined
  }

  getPredictedHapInstanceForChannel (channel) {
    // first get the room
    if (channel) {
      let room = this.getRoombyChannelId(channel.id)
      if (room) {
        // get the rooms hapInstance
        return this.getHapInstanceByRoomId(room.id)
      }
    }
  }

  showInstances () {
    let self = this
    $('#containerTitle').html(self.__('HomeKit Instances'))
    let hapCcontainer = $('#container')
    let containerFooter = $('#container_footer')
    hapCcontainer.empty()

    let grid = new DatabaseGrid('instList', this.bridges, {})

    grid.setTitleLabels([self.__('Instance name'), 'Port', self.__('PinCode'), self.__('Published devices'), self.__('CCU Room')])

    grid.setColumns([
      {sz: {sm: 6, md: 3, lg: 3, xl: 3}, sort: 0},
      {sz: {sm: 6, md: 1, lg: 1, xl: 1}},
      {sz: {sm: 6, md: 2, lg: 2, xl: 2}},
      {sz: {sm: 6, md: 1, lg: 1, xl: 1}},
      {sz: {sm: 6, md: 2, lg: 2, xl: 2}, sort: 4},
      {sz: {sm: 6, md: 1, lg: 1, xl: 1}},
      {sz: {sm: 6, md: 1, lg: 1, xl: 1}},
      {sz: {sm: 6, md: 1, lg: 1, xl: 1}}
    ])

    grid.sortCallback = (column, a, b) => {
      switch (column) {
        case 0:
          return (a.displayName).localeCompare(b.displayName)
        case 4:
          let roomA = self.getRoombyId(a.roomId) || {name: ''}
          let roomB = self.getRoombyId(b.roomId) || {name: ''}
          return roomA.name.localeCompare(roomB.name)

        default:
          return true
      }
    }

    grid.columnSort = 4

    grid.setRenderer((row, item) => {
      let editButton = new Button('success', self.__('Edit'), (e, btn) => {
        new EditHapInstanceWizzard(this).run(item)
      }, true)

      let deleteButton = new Button('danger', self.__('Delete'), (e, btn) => {
        new DeleteHapInstanceWizzard(this).run(item)
      }, true)

      let deactivateButton = new Button('danger', self.__('Deactivate'), (e, btn) => {
        new DeactivateInstanceWizzard(this).run(item)
      }, true)

      // b6589fc6-ab0d-4c82-8f12-099d1c2d40ab is the default ID
      if (item.id === 'b6589fc6-ab0d-4c82-8f12-099d1c2d40ab') {
        deleteButton.setActive(false)
        editButton.setActive(false)
      }

      deactivateButton.setActive(item.hasPublishedDevices)

      let room = self.getRoombyId(item.roomId)
      return ([item.displayName,
        item.port,
        item.pincode,
        item.hasPublishedDevices ? self.__('Yes') : self.__('No'),
        (room !== undefined) ? room.name : '',
        editButton.render(),
        deleteButton.render(),
        deactivateButton.render()
      ])
    })
    hapCcontainer.append(grid.render())

    let newButton = new Button('primary', self.__('New'), async (e, btn) => {
      new NewHAPInstanceWizzard(this).run()
    })
    newButton.setStyle('float:right')
    containerFooter.empty()
    containerFooter.append(newButton.render())
  }

  showSpecial () {
    let self = this
    $('#containerTitle').html(self.__('Special devices'))
    let container = $('#container')
    let containerFooter = $('#container_footer')
    container.empty()

    let grid = new DatabaseGrid('specialList', this.specialList, {})

    grid.setTitleLabels([self.__('HomeKit name'), self.__('Service'), self.__('Instance name')])

    grid.setColumns([
      {sz: {sm: 6, md: 3, lg: 3, xl: 3}},
      {sz: {sm: 6, md: 3, lg: 3, xl: 3}},
      {sz: {sm: 6, md: 3, lg: 3, xl: 3}},
      {sz: {sm: 6, md: 2, lg: 2, xl: 2}},
      {sz: {sm: 6, md: 1, lg: 1, xl: 1}}
    ])

    grid.setRenderer((row, item) => {
      let editButton = new Button('success', self.__('Edit'), (e, btn) => {
        let wz = new EditDeviceWizzard(this)
        wz.run(item)
      }, true)

      let deleteButton = new Button('danger', self.__('Delete'), (e, btn) => {
        let wz = new DeleteDeviceWizzard(this)
        wz.run(item)
      }, true)

      let bridge = self.getBridgeWithId(item.instanceID)
      let badgeState = (item.isPublished === true) ? 'badge-success' : 'badge-secondary'

      return ([item.name,
        item.serviceClass,
        $('<span>').attr('class', 'badge ' + badgeState).append(bridge.displayName),
        editButton.render(),
        deleteButton.render()
      ])
    })

    container.append(grid.render())

    let newButton = new Button('primary', self.__('New'), async (e, btn) => {
      let wzNew = new EditDeviceWizzard(this)

      wzNew.run({
        settings: {settings: {}},
        name: 'Name',
        serial: 'new',
        channel: 'special',
        uuid: 'new'
      })
    })
    newButton.setStyle('float:right')
    containerFooter.empty()
    containerFooter.append(newButton.render())
  }

  showVariables () {
    let self = this
    $('#containerTitle').html(self.__('Variables'))
    let hapCcontainer = $('#container')
    let containerFooter = $('#container_footer')
    hapCcontainer.empty()

    let grid = new DatabaseGrid('varList', this.variableList, {})

    grid.setTitleLabels([self.__('HomeKit name'), self.__('HomeMatic name'), self.__('Instance name')])

    grid.setColumns([
      {sz: {sm: 6, md: 3, lg: 3, xl: 3}, sort: 0},
      {sz: {sm: 6, md: 3, lg: 3, xl: 3}, sort: 1},
      {sz: {sm: 6, md: 2, lg: 3, xl: 3}, sort: 2},
      {sz: {sm: 6, md: 2, lg: 2, xl: 2}},
      {sz: {sm: 6, md: 2, lg: 1, xl: 1}}
    ])

    grid.sortCallback = (column, a, b) => {
      switch (column) {
        case 0:
          return (a.serial + ':' + a.channel).localeCompare(b.serial + ':' + b.channel)
        case 1:
          return a.name.localeCompare(b.name)
        case 2:
          let ba = this.getBridgeWithId(a.instanceID)
          let bb = this.getBridgeWithId(b.instanceID)
          return (ba.displayName).localeCompare(bb.displayName)
        default:
          return true
      }
    }

    grid.columnSort = 0

    grid.setRenderer((row, item) => {
      let editButton = new Button('success', self.__('Edit'), (e, btn) => {
        let wz = new EditObjectWizzard(self, self.__('Edit variable'))
        wz.setServices(self.variableServices)
        wz.willSave((wizzard) => {
          wizzard.objectData.method = 'saveVariable'
        })

        wz.onClose(() => {
          self.refreshVariables()
        })

        wz.run(item)
      }, true)

      let deleteButton = new Button('danger', self.__('Delete'), (e, btn) => {
        new DeleteVariableWizzard(this).run(item)
      }, true)

      let bridge = self.getBridgeWithId(item.instanceID)
      let badgeState = (item.isPublished === true) ? 'badge-success' : 'badge-secondary'

      return ([item.name, item.serial, $('<span>').attr('class', 'badge ' + badgeState).append(bridge.displayName), editButton.render(), deleteButton.render()])
    })

    hapCcontainer.append(grid.render())

    let newButton = new Button('primary', self.__('New'), async (e, btn) => {
      let mapVariables = await this.makeApiRequest({method: 'newVariable'})
      let wz = new NewObjectWizzard(this, this.__('Add new Variable'), this.__('Setup variable'))
      wz.setServices(self.variableServices)

      wz.willSave((wizzard) => {
        wizzard.objectData.method = 'saveVariable'
      })

      wz.onClose(() => {
        self.refreshVariables()
      })

      wz.checkObjectIsMapped((item) => {
        return self.getVariableBySerial(item.name)
      })

      wz.setListTitles([self.__('Variable'), self.__('Description')])

      wz.run(mapVariables.variables)
    })
    newButton.setStyle('float:right')

    let varTrigger = new Input('varTrigger', this.variableTrigger, (e, input) => {

    })
    varTrigger.setStyle('width:100%')
    varTrigger.setGroupLabel('Trigger')

    let UpdateTriggerButton = new Button('primary', self.__('Update Trigger'), async (e, btn) => {
      let triggerDp = varTrigger.getValue()
      if (triggerDp) {
        await self.makeApiRequest({method: 'saveVariableTrigger', datapoint: triggerDp})
        self.refreshVariables()
      }
    })
    UpdateTriggerButton.setStyle('float:right')

    containerFooter.empty()

    let gridFooter = new Grid()
    gridFooter.addRow().addCell({sm: 12, md: 12, lg: 12, xl: 12}, newButton.render())

    let triggerRow = gridFooter.addRow('', {rowStyle: 'margin-bottom:15px'})
    triggerRow.addCell({sm: 12, md: 6, lg: 4, xl: 4}, varTrigger.render())
    triggerRow.addCell({sm: 12, md: 6, lg: 4, xl: 4}, UpdateTriggerButton.render())

    gridFooter.addRow().addCell({sm: 12, md: 12, lg: 12, xl: 12}, new Label(this.__('This has to be a KEY datapoint. All variables will be updated on an event at this KEY')).render())
    containerFooter.append(gridFooter.render())
  }

  showPrograms () {
    let self = this
    $('#containerTitle').html(self.__('Programs'))
    let hapCcontainer = $('#container')
    let containerFooter = $('#container_footer')
    hapCcontainer.empty()

    let grid = new DatabaseGrid('progList', this.programList, {})

    grid.setTitleLabels([self.__('HomeKit name'), self.__('HomeMatic name'), self.__('Instance name')])

    grid.setColumns([
      {sz: {sm: 6, md: 3, lg: 3, xl: 3}, sort: 0},
      {sz: {sm: 6, md: 3, lg: 3, xl: 3}, sort: 1},
      {sz: {sm: 6, md: 2, lg: 3, xl: 3}, sort: 2},
      {sz: {sm: 6, md: 2, lg: 2, xl: 2}},
      {sz: {sm: 6, md: 2, lg: 1, xl: 1}}
    ])

    grid.sortCallback = (column, a, b) => {
      switch (column) {
        case 0:
          return a.name.localeCompare(b.name)
        case 1:
          return (a.serial + ':' + a.channel).localeCompare(b.serial + ':' + b.channel)
        case 2:
          let ba = this.getBridgeWithId(a.instanceID)
          let bb = this.getBridgeWithId(b.instanceID)
          return (ba.displayName).localeCompare(bb.displayName)
        default:
          return true
      }
    }
    grid.columnSort = 0

    grid.setRenderer((row, item) => {
      let editButton = new Button('success', self.__('Edit'), (e, btn) => {
        let wz = new EditObjectWizzard(self, self.__('Edit program'))

        wz.willSave((wizzard) => {
          wizzard.objectData.method = 'saveProgram'
        })

        wz.onClose(() => {
          self.refreshPrograms()
        })

        wz.run(item)
      }, true)

      let deleteButton = new Button('danger', self.__('Delete'), (e, btn) => {
        let wz = new DeleteProgramWizzard(self, self.__('Remove program'))
        wz.run(item)
      }, true)

      let bridge = self.getBridgeWithId(item.instanceID)
      let badgeState = (item.isPublished === true) ? 'badge-success' : 'badge-secondary'

      return ([item.name, item.serial, $('<span>').attr('class', 'badge ' + badgeState).append(bridge.displayName), editButton.render(), deleteButton.render()])
    })

    hapCcontainer.append(grid.render())

    let newButton = new Button('primary', self.__('New'), async (e, btn) => {
      let mapPrograms = await this.makeApiRequest({method: 'newProgram'})
      let wz = new NewObjectWizzard(this, this.__('Add new program'), this.__('Setup program'))

      wz.willSave((wizzard) => {
        wizzard.objectData.method = 'saveProgram'
      })

      wz.onClose(() => {
        self.refreshPrograms()
      })

      wz.checkObjectIsMapped((item) => {
        return self.getProgramBySerial(item.name)
      })

      wz.setListTitles([self.__('Program'), self.__('Description')])

      wz.run(mapPrograms.programs)
    })
    newButton.setStyle('float:right')

    containerFooter.empty()
    containerFooter.append(newButton.render())
  }

  async publish (bridgeId) {
    var bridgesToPublishDevices = []
    this.bridges.map(bridge => {
      if ((bridge.publish === true) || (bridge.id === bridgeId)) {
        bridgesToPublishDevices.push(bridge.id)
      }
    })
    await this.makeApiRequest({method: 'publish', bridges: JSON.stringify(bridgesToPublishDevices)})
  }

  async refreshBridges () {
    this.bridges = await this.makeApiRequest({method: 'bridges'})
    this.buildOverview()
    this.showInstances()
  }

  async refreshVariables () {
    let tmp = await this.makeApiRequest({method: 'variablelist'})
    if (tmp) {
      this.variableList = tmp.variables
      this.variableTrigger = tmp.trigger
    }
    this.showVariables()
  }

  async refreshPrograms () {
    let tmp = await this.makeApiRequest({method: 'programlist'})
    if (tmp) {
      this.programList = tmp.programs
    }
    this.showPrograms()
  }

  checkPermissionFromError (e) {
    let self = this
    if ((e.status === 401) && (!this.errorShown)) {
      this.errorShown = true
      let dialog = new InvalidCredentialsDialog(this)
      dialog.onClose = () => {
        self.errorShown = false
      }
      dialog.run()
    }
  }

  async refreshAll () {
    try {
      this.bridges = await this.makeApiRequest({method: 'bridges'})
    } catch (e) {
      this.checkPermissionFromError(e)
    }

    this.deviceList = await this.makeApiRequest({method: 'devicelist'})
    let tmp = await this.makeApiRequest({method: 'variablelist'})
    if (tmp) {
      this.variableList = tmp.variables
      this.variableTrigger = tmp.trigger
      this.variableServices = tmp.services
    }

    tmp = await this.makeApiRequest({method: 'programlist'})
    if (tmp) {
      this.programList = tmp.programs
    }

    tmp = await this.makeApiRequest({method: 'roomlist'})
    if (tmp) {
      this.roomList = tmp.rooms
    }

    this.buildDeviceList(0, 10)
    this.systemInfo = await this.makeApiRequest({method: 'system'})
    this.buildOverview()
    tmp = await this.makeApiRequest({method: 'speciallist'})
    if (tmp) {
      this.specialList = tmp.special
    }
  }

  hook () {
    let self = this
    $('#showDevices').bind('click', (e) => {
      self.refreshAll()
      $('#breadcrum_page').html(this.__('Devices'))
    })

    $('#publishingSettings').bind('click', (e) => {
      new PublishDevicesSettingsWizzard(this).run()
    })

    $('#hapInstances').bind('click', (e) => {
      self.showInstances()
      $('#breadcrum_page').html(this.__('HomeKit Instances'))
    })

    $('#showVariables').bind('click', (e) => {
      self.showVariables()
      $('#breadcrum_page').html(this.__('Variables'))
    })

    $('#showPrograms').bind('click', (e) => {
      self.showPrograms()
      $('#breadcrum_page').html(this.__('Programs'))
    })

    $('#showSpecialDevices').bind('click', (e) => {
      self.showSpecial()
      $('#breadcrum_page').html(this.__('Special devices'))
    })

    $('#btn_debug').bind('click', async (e) => {
      await self.makeApiRequest({method: 'debug', enable: !self.debugMode})
      setTimeout(async () => {
        self.systemInfo = await this.makeApiRequest({method: 'system'})
        self.buildOverview()
      }, 500)
    })

    $('#btn_restart').bind('click', async () => {
      self.updateDialog = new RebootUpdateDialog(this)
      self.updateDialog.setProceed(async (enableLog) => {
        self.makeApiRequest({method: 'restart', debug: enableLog})
        setTimeout(() => {
          self.waitForReboot()
        }, 2000)
      })
      self.updateDialog.run(self.__('Restart HAP Plugin ?'))
    })

    $('#btn_changelog').bind('click', async () => {
      let cl = await this.makeApiRequest({method: 'changelog'}, 'text')
      let dialog = new Dialog({
        dialogId: 'changeLog',
        buttons: [
          new Button('light', 'Oh, i got it', (e, btn) => {
            dialog.close()
          }, true)
        ],
        title: self.__('Changelog'),
        dialogClass: 'modal-info',
        scrollable: true,
        size: 'modal-xl'
      })

      let converter = new showdown.Converter()
      dialog.setBody(converter.makeHtml(cl))
      dialog.open()
    })

    $('#btn_settings').bind('click', () => {
      let sad = new SettingsDialog(this)
      sad.setProceed(async (settings) => {
        await this.makeApiRequest({method: 'saveSettings', settings: JSON.stringify(settings)})
      })
      sad.run()
    })

    $('#btn_dnlog').bind('click', () => {
      window.location.href = '/api/?method=getLog&sid=' + self.sid
    })
  }

  // this will drive me nuts .. i can feel it
  __ () {
    return this.localizer.localize.apply(this.localizer, arguments)
  }

  async waitForReboot () {
    let self = this
    this.makeApiRequest({method: 'bridges'}).then((result) => {
      if (self.updateDialog) {
        self.updateDialog.close()
      }
      self.refreshAll()
    }).catch((e) => {
      if (e.status === 401) {
        self.checkPermissionFromError(e)
      }
      setTimeout(() => {
        self.waitForReboot()
      }, 2000)
    })
  }

  async run () {
    this.localizer = new Localization()
    await this.localizer.init()
    this.localizer.localizePage()
    this.deviceList = []
    this.variableList = []
    this.programList = []
    this.rooms = []
    this.hook()
    await this.refreshAll()

    // check if we have 1 bridge and no devices cause this may look like a new installation
    if ((this.bridges) && (this.deviceList) && (this.deviceList.length === 0)) {
      let mapDevices = await this.makeApiRequest({method: 'wizzardRooms'})

      if (this.bridges.length === 1) {
        new WelcomeWizzard(this).run(mapDevices, 0)
      } else {
        new WelcomeWizzard(this).run(mapDevices, 2)
      }
    }
  }
}
