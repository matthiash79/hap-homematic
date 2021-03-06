import {Dialog, Button,
  Grid, DatabaseGrid,
  Dropdown, Input, CheckBox, Spinner, Label} from './ui.js'

export class Wizzard {
  constructor (application) {
    this.application = application
    let self = this
    this.activitySpinner = new Spinner()

    this.dissmissButton = new Button('light', self.__('Dismiss'), (e, btn) => {
      if (self.dialog) {
        if (self.onClose) {
          self.onClose()
        }
        self.dialog.close()
      }
    }, true)
  }

  __ () {
    // this is crazy
    return this.application.__.apply(this.application, arguments)
  }

  run () {
    if (this.dialog) {
      this.dialog.open()
    }
  }

  close () {
    if (this.dialog) {
      this.dialog.close()
    }
  }
}

export class RebootUpdateDialog extends Wizzard {
  constructor (application) {
    super(application)
    let self = this
    this.debug = false
    this.debugControl = new CheckBox('debug', false, (e, input) => {
      self.debug = input.checked
    })
    this.debugControl.setLabel(this.__('Enable debug at launch'))
    this.proceedButton = new Button('danger', self.__('YOLO'), async (e, btn) => {
      self.activitySpinner.setActive(true)
      self.dissmissButton.setActive(false)
      self.proceedButton.setActive(false)
      if (self.proceed) {
        self.proceed(self.debug)
      }
    }, true)
    this.dissmissButton.setLabel(self.__('Covfefe'))
    this.dialog = new Dialog({
      dialogId: 'updateRebootDialog',
      buttons: [
        self.activitySpinner,
        self.dissmissButton,
        self.proceedButton
      ],
      title: self.__('Sure ?'),
      dialogClass: 'modal-danger',
      scrollable: true,
      size: 'modal-md'
    })
  }

  setProceedLabel (lbl) {
    this.proceedButton.setLabel(lbl)
  }

  setProceed (callback) {
    this.proceed = callback
  }

  run (message) {
    let content = $('<div>')
    content.append(message)
    content.append('<br /><br />')
    content.append(this.debugControl.render())
    this.dialog.setBody(content)
    this.dialog.open()
  }
}

export class SettingsDialog extends Wizzard {
  constructor (application) {
    super(application)
    let self = this
    let settings = {}
    settings.useAuth = application.systemInfo.useAuth
    this.authControl = new CheckBox('useAuthentication', settings.useAuth, (e, input) => {
      settings.useAuth = input.checked
    })
    this.authControl.setLabel(self.__('Use CCU Authentication'))

    settings.useTLS = application.systemInfo.useTLS
    this.tlsControl = new CheckBox('useTLS', settings.useTLS, (e, input) => {
      settings.useTLS = input.checked
    })
    this.tlsControl.setLabel(self.__('Use HTTPS'))

    let proceedButton = new Button('info', self.__('Save'), async (e, btn) => {
      self.activitySpinner.setActive(true)
      self.dissmissButton.setActive(false)
      proceedButton.setActive(false)
      if (self.proceed) {
        self.proceed(settings)
      }
      self.dialog.close()
    }, true)

    this.dialog = new Dialog({
      dialogId: 'SettingsDialog',
      buttons: [
        self.activitySpinner,
        self.dissmissButton,
        proceedButton
      ],
      title: self.__('Settings'),
      dialogClass: 'modal-danger',
      scrollable: true,
      size: 'modal-md'
    })
  }

  setProceed (callback) {
    this.proceed = callback
  }

  run (message) {
    let content = $('<div>')
    content.append(message)
    content.append('<br />')
    content.append(this.authControl.render())
    content.append('<br />')
    content.append(this.tlsControl.render())
    this.dialog.setBody(content)
    this.dialog.open()
  }
}

export class InvalidCredentialsDialog extends Wizzard {
  constructor (application) {
    super(application)
    let self = this

    this.dialog = new Dialog({
      dialogId: 'invalidCredentialDialog',
      buttons: [
        self.dissmissButton
      ],
      title: self.__('Invalid credentials'),
      dialogClass: 'modal-danger',
      scrollable: true,
      size: 'modal-md'
    })
  }

  run () {
    let content = $('<div>')
    content.append(this.__('U are not allowed to use this application. Please log in thru your ccu first.'))
    content.append('<br /><br />')
    this.dialog.setBody(content)
    this.dialog.open()
  }
}

export class DeleteItemWizzard extends Wizzard {
  constructor (application) {
    super(application)
    let self = this

    let deleteButton = new Button('danger', self.__('Yes, kick it baby'), async (e, btn) => {
      self.activitySpinner.setActive(true)
      self.dissmissButton.setActive(false)
      deleteButton.setActive(false)
      self.deleteItem()

      setTimeout(() => {
        self.dialog.close()
      }, 2000)
    }, true)

    this.dialog = new Dialog({
      dialogId: self.getDialogId(),
      buttons: [
        self.activitySpinner,
        self.dissmissButton,
        deleteButton
      ],
      title: self.getTitle(),
      dialogClass: 'modal-danger',
      scrollable: true,
      size: 'modal-md'
    })
  }

  getDialogId () { return 'id' }
  getTitle () { return 'YOU SHOULD PROVIDE A TITLE IN YOUR SUBCLASS' }
  deleteItem () {}
}

/** this is the dialog class for removing an device */
export class DeleteDeviceWizzard extends DeleteItemWizzard {
  async deleteItem () {
    let self = this
    await this.application.makeApiRequest({method: 'removeDevice', uuid: this.device.UUID})
    setTimeout(() => {
      self.application.refreshAll()
    }, 2000)
  }

  getDialogId () { return 'deleteDeviceDialog' }
  getTitle () { return this.__('Remove ...') }

  run (device) {
    this.device = device
    this.dialog.setBody(this.__('Are you sure you want to remove %s from HomeKit?', device.name))
    this.dialog.open()
  }
}

/** this is the dialog class for removing an hap instance */
export class DeleteHapInstanceWizzard extends DeleteItemWizzard {
  async deleteItem () {
    let self = this
    if (this.hapInstance.id !== 0) {
      await this.application.makeApiRequest({method: 'removehapinstance', id: this.hapInstance.id})
      setTimeout(() => {
        self.application.refreshBridges()
        self.dialog.close()
      }, 2000)
    }
  }

  getDialogId () { return 'deleteDeviceDialog' }
  getTitle () { return this.__('Remove ...') }

  run (hapInstance) {
    this.hapInstance = hapInstance
    this.dialog.setBody(this.__('Are you sure you want to remove %s? All your devices will be reassigned to the default Instance.', hapInstance.displayName))
    this.dialog.open()
  }
}

export class DeleteVariableWizzard extends DeleteItemWizzard {
  async deleteItem () {
    let self = this
    if (this.variable.serial !== undefined) {
      await this.application.makeApiRequest({method: 'removeVariable', serial: this.variable.serial, uuid: this.variable.UUID})
      setTimeout(() => {
        self.application.refreshVariables()
        self.dialog.close()
      }, 2000)
    }
  }

  getDialogId () { return 'deleteDeviceDialog' }
  getTitle () { return this.__('Remove ...') }

  run (variable) {
    this.variable = variable
    this.dialog.setBody(this.__('Are you sure you want to remove %s?', variable.name))
    this.dialog.open()
  }
}

export class DeleteProgramWizzard extends DeleteItemWizzard {
  async deleteItem () {
    let self = this
    if (this.program.serial !== undefined) {
      await this.application.makeApiRequest({method: 'removeProgram', serial: this.program.serial, uuid: this.program.UUID})
      setTimeout(() => {
        self.application.refreshPrograms()
        self.dialog.close()
      }, 2000)
    }
  }

  getDialogId () { return 'deleteProgramDialog' }
  getTitle () { return this.__('Remove ...') }

  run (program) {
    this.program = program
    this.dialog.setBody(this.__('Are you shure you want to remove %s?', program.name))
    this.dialog.open()
  }
}

// this is the Abstract Class used by edit and new Device Wizzard
export class AbstractEditSettingsWizzard extends Wizzard {
  async buildDeviceSettings () {
    let self = this
    self.grid.resetRows()

    let inputName = new Input('devicename', self.serviceSettings.name, (e, input) => {
      self.serviceSettings.name = input.value
    })
    console.log('Getting Servicedata for %s', JSON.stringify(this.serviceSettings))
    let serviceList = await self.application.makeApiRequest({method: 'service', channelAddress: this.serviceSettings.address})

    let oServiceList = new Dropdown('newDeviceService', self.serviceSettings.serviceClass || '')
    serviceList.service.map(service => {
      // set the current template
      if (service.serviceClazz === self.serviceSettings.serviceClass) {
        self.serviceSettings.template = service.settings
      }
      oServiceList.addItem({
        title: service.serviceClazz,
        value: service.serviceClazz,
        onClick: async (e, btn) => {
          self.serviceSettings.serviceClass = btn
          self.serviceSettings.template = service.settings
          await self.buildDeviceSettings()
          self.grid.render()
        }
      })
    })
    // create a empty settings mapp
    if (self.serviceSettings.settings === undefined) {
      self.serviceSettings.settings = {}
    }
    // select the first service if there is none
    if ((self.serviceSettings.serviceClass === undefined) && (serviceList.service.length > 0)) {
      self.serviceSettings.serviceClass = serviceList.service[0].serviceClazz
      self.serviceSettings.template = serviceList.service[0].settings
      oServiceList.setTitle(self.serviceSettings.serviceClass)
    }

    let hapList = new Dropdown('newDeviceHapList', self.__('Select a instance'))
    self.application.getBridges().map(bridge => {
      if (bridge.id === self.serviceSettings.instanceID) {
        hapList.setTitle(bridge.displayName)
      }
      hapList.addItem({
        title: bridge.displayName,
        value: bridge.id,
        onClick: (e, btn) => {
          self.serviceSettings.instanceID = btn
        }
      })
    })

    var row = self.grid.addRow('deviceName')
    row.addCell({sm: 12, md: 2, lg: 2}, self.__('Homekit Device name'))
    row.addCell({sm: 12, md: 5, lg: 5}, inputName.render())
    row.addCell({sm: 12, md: 5, lg: 5}, self.__('You may change the devicename as u like.'))

    row = self.grid.addRow('service')
    row.addCell({sm: 12, md: 2, lg: 2}, self.__('Service'))
    row.addCell({sm: 12, md: 7, lg: 5}, oServiceList.render())
    row.addCell({sm: 12, md: 3, lg: 5}, self.__('Select the service you want to use for this channel'))

    if (this.serviceSettings.template) {
      Object.keys(this.serviceSettings.template).map(settingsKey => {
        let template = self.serviceSettings.template[settingsKey]
        let settings = self.serviceSettings.settings[settingsKey]
        var control
        switch (template.type) {
          case 'option':
            control = new Dropdown(settingsKey, settings || template.default)
            template.array.map(item => {
              control.addItem({
                title: item,
                value: item,
                onClick: (e, btn) => {
                  self.serviceSettings.settings[settingsKey] = btn
                }
              })
            })
            break

          case 'number':
            control = new Input(settingsKey, parseInt(settings) || parseInt(template.default), (e, input) => {
              self.serviceSettings.settings[settingsKey] = parseInt(input.value)
            })
            break

          case 'text':
            control = new Input(settingsKey, settings || template.default, (e, input) => {
              self.serviceSettings.settings[settingsKey] = input.value
            })
            break

          case 'checkbox':
            control = new CheckBox(settingsKey, true, (e, input) => {
              self.serviceSettings.settings[settingsKey] = input.checked
            })
            control.setValue(settings || template.default)
            break

          default:
            break
        }
        if ((!self.serviceSettings.settings[settingsKey]) && (template.default)) {
          self.serviceSettings.settings[settingsKey] = template.default
        }
        row = self.grid.addRow('st_' + settingsKey)
        row.addCell({sm: 12, md: 2, lg: 2}, self.__(template.label || ''))
        row.addCell({sm: 12, md: 5, lg: 5}, (control) ? control.render() : '')
        row.addCell({sm: 12, md: 5, lg: 5}, self.__(template.hint || ''))
      })
    }

    row = self.grid.addRow('hapInstance')

    row.addCell({sm: 12, md: 2, lg: 2}, self.__('HAP Instance'))
    row.addCell({sm: 12, md: 5, lg: 5}, hapList.render())
    row.addCell({sm: 12, md: 5, lg: 5}, self.__('Select the HAP Instance to which you want to add this channel'))
  }
}

export class NewDeviceWizzard extends AbstractEditSettingsWizzard {
  constructor (application) {
    super(application)
    let self = this
    this.serviceSettings = {
      method: 'saveNewDevice'
    }

    this.status = new Label()

    self.finishButton = new Button('success', self.__('Finish'), async (e, btn) => {
      if (self.serviceSettings.instanceID === undefined) {
        self.status.setLabel(self.__('Please choose a HAP instance'))
      } else {
        self.finishButton.setActive(false)
        self.activitySpinner.setActive(true)
        self.dissmissButton.setActive(false)
        self.createNewDevice()
      }
    }, false)

    self.dialog = new Dialog({
      dialogId: 'addNew',
      buttons: [
        self.status,
        self.activitySpinner,
        self.dissmissButton,
        self.finishButton
      ],
      title: self.__('Add new device'),
      dialogClass: 'modal-info',
      scrollable: false,
      size: 'modal-xl'
    })
  }

  buildSuggestedName (device, channel) {
    if ((device) && (channel)) {
      let cDefaultName = device.type + ' ' + channel.address
      let idx = cDefaultName.indexOf(channel.name)
      if (idx === -1) {
        return channel.name.replace(/[.:#_()-]/g, ' ')
      } else {
        return device.name.replace(/[.:#_()-]/g, ' ')
      }
    }
  }

  async buildNewDeviceStep2 () {
    let self = this
    let content = $('<div>').append(self.__('Please setup the service for %s  (%s)', this.channel.name, this.channel.address)).append('<br /><br />')
    this.grid = new Grid('newDeviceGrid', {rowStyle: 'margin-bottom:15px'})
    await self.buildDeviceSettings()
    content.append(this.grid.render())
    self.dialog.setBody(content)
  }

  run (deviceList) {
    let self = this
    let content = $('<div>').append(self.__('Please select a channel to add to homeKit')).append('<br /><br />')

    // build the dataset
    let dataset = []
    deviceList.map(device => {
      device.channels.map(channel => {
        dataset.push([device, channel])
      })
    })

    let grid = new DatabaseGrid('ndevices', dataset, {})

    grid.addSearchBar(self.__('Search'), self.__('Clear'), (element, filter) => {
      if (element.length > 1) {
        return (((element[0].name) && (element[0].name.toLowerCase().indexOf(filter.toLowerCase()) > -1)) ||
              ((element[1].name) && (element[1].name.toLowerCase().indexOf(filter.toLowerCase()) > -1)))
      } else {
        return false
      }
    })

    grid.setTitleLabels([self.__('Device'), self.__('Type'), self.__('Channel'), self.__('Type')])

    grid.setColumns([
      {sz: {sm: 6, md: 2, lg: 2}, sort: 0},
      {sz: {sm: 6, md: 2, lg: 2}, sort: 1},
      {sz: {sm: 6, md: 3, lg: 3}, sort: 2},
      {sz: {sm: 6, md: 3, lg: 3}, sort: 3},
      {sz: {sm: 6, md: 2, lg: 2}}
    ])

    grid.sortCallback = (column, a, b) => {
      let deviceA = a[0]
      let channelA = a[1]

      let deviceB = b[0]
      let channelB = b[1]

      switch (column) {
        case 0:
          return deviceA.name.localeCompare(deviceB.name)
        case 1:
          return deviceA.type.localeCompare(deviceB.type)
        case 2:
          return channelA.name.localeCompare(channelB.name)
        case 3:
          return channelA.type.localeCompare(channelB.type)
        default:
          return true
      }
    }
    grid.columnSort = 0

    grid.setRenderer((row, item) => {
      let result = []
      let device = item[0]
      let channel = item[1]

      result.push(device.name)
      result.push(device.type)
      result.push(channel.name)
      result.push(channel.type)

      if (self.application.getServiceByAddress(channel.address) === undefined) {
        let button = new Button('info', self.__('Select'), (e, btn) => {
          self.serviceSettings.name = self.buildSuggestedName(self.serviceSettings.device, self.serviceSettings.channel) || channel.name
          self.serviceSettings.channel = channel
          self.channel = channel
          self.device = device
          self.serviceSettings.address = channel.address
          let hapInstance = self.application.getPredictedHapInstanceForChannel(channel)
          self.serviceSettings.instanceID = (hapInstance) ? hapInstance.id : undefined
          self.buildNewDeviceStep2()
          self.finishButton.setActive(true)
        }, true)
        button.setStyle('width:100%')
        result.push(button.render())
      } else {
        let button = new Button('secondary', self.__('allready here'), () => {}, true)
        button.setStyle('width:100%')
        result.push(button.render())
      }

      return result
    })

    content.append(grid.render())

    self.dialog.setBody(content)
    self.dialog.open()
  }

  async createNewDevice () {
    let self = this
    if (self.serviceSettings.instanceID !== undefined) {
      this.status.setLabel(this.__('Creating device ...'))
      let settings = self.serviceSettings.settings
      // create JSON String from settings to make post easyer
      if (settings) {
        self.serviceSettings.settings = JSON.stringify(settings)
      }
      // remove other stuff
      if (self.serviceSettings.template) {
        delete self.serviceSettings.template
      }
      if (self.serviceSettings.channel) {
        delete self.serviceSettings.channel
      }

      await self.application.makeApiRequest(self.serviceSettings)
      await self.application.publish()
      setTimeout(() => {
        self.application.refreshAll()
        self.dialog.close()
      }, 2000)
    }
  }
}

export class EditDeviceWizzard extends AbstractEditSettingsWizzard {
  constructor (application) {
    super(application)
    let self = this
    this.statusLabel = new Label()
    let publishButton = new Button('success', self.__('Finish'), async (e, btn) => {
      self.activitySpinner.setActive(true)
      self.dissmissButton.setActive(false)
      publishButton.setActive(false)
      let saveResult = await self.saveDevice()
      if (saveResult === true) {
        setTimeout(() => {
          self.application.refreshAll()
          self.dialog.close()
        }, 2000)
      } else {
        self.activitySpinner.setActive(false)
        self.dissmissButton.setActive(true)
        publishButton.setActive(true)
      }
    }, true)

    self.dialog = new Dialog({
      dialogId: 'editDevice',
      buttons: [
        self.statusLabel,
        self.activitySpinner,
        self.dissmissButton,
        publishButton
      ],
      title: self.__('Edit device'),
      dialogClass: 'modal-info',
      scrollable: false,
      size: 'modal-xl'
    })

    this.sanityCheckFunction = (template, settings) => {
      var result = true
      Object.keys(template).map(key => {
        let st = template[key]
        if ((st.mandatory !== undefined) && (st.mandatory === true) && (settings[key] === undefined)) {
          result = false
        }
      })
      return result
    }
  }

  sanityCheck (check) {
    this.sanityCheckFunction = check
  }

  saveDevice () {
    return new Promise(async (resolve, reject) => {
      let settings = this.serviceSettings.settings
      let self = this
      var canSave = true
      if (this.sanityCheckFunction) {
        let result = this.sanityCheckFunction(this.serviceSettings.template, settings)
        if (result === false) {
          self.statusLabel.setLabel(self.__('Some mandatory fields are missing'))
          canSave = false
          resolve(false)
        }
      }

      if (canSave === true) {
        if (settings) {
          this.serviceSettings.settings = JSON.stringify(settings)
        }
        // remove other stuff
        if (this.serviceSettings.template) {
          delete this.serviceSettings.template
        }
        if (this.serviceSettings.channel) {
          delete this.serviceSettings.channel
        }
        self.statusLabel.setLabel(self.__('Proceeding ...'))
        await this.application.makeApiRequest(this.serviceSettings)
        await this.application.publish()
        resolve(true)
      }
    })
  }

  async run (device) {
    let self = this
    this.serviceSettings = {
      method: 'saveDevice',
      name: device.name,
      address: device.serial + ':' + device.channel,
      instanceID: device.instanceID,
      serviceClass: device.serviceClass,
      settings: device.settings.settings, // this will blow my mind
      uuid: device.UUID}
    let content = $('<div>').append(self.__('Edit your device %s here', device.name))
    content.append('<br /><br />')
    this.grid = new Grid('editDeviceGrid', {rowStyle: 'margin-bottom:15px'})
    await self.buildDeviceSettings()
    content.append(this.grid.render())
    self.dialog.setBody(content)
    self.dialog.open()
  }
}

export class PublishDevicesSettingsWizzard extends Wizzard {
  constructor (application) {
    super(application)
    let self = this
    let content = $('<div>').append(self.__('For the first setup you want to expose the bridge(s) without devices to HomeKit. So you are easily able to assign rooms to that bridge(s). If you do another publish with devices in the second step, they will be automaticaly added to the room where the particular bridge is located.'))
    content.append('<br /><br />')
    content.append(self.__('Publish bridge instances with devices:')).append('<br /><br />')

    self.application.getBridges().map(bridge => {
      let checkBox = new CheckBox('publish_' + bridge.id, (bridge.hasPublishedDevices === true), (e, input) => {
        bridge.publish = input.checked
      })
      // if the bridge was published with devices user cannot remove the checkbox anymore
      if (bridge.hasPublishedDevices === true) {
        checkBox.setEnabled(false)
      }
      checkBox.setLabel(self.__('Publish devices for %s', bridge.displayName))
      content.append(checkBox.render())
      content.append('<br />')
    })

    let publishButton = new Button('success', self.__('Finish'), (e, btn) => {
      self.activitySpinner.setActive(true)
      self.dissmissButton.setActive(false)
      publishButton.setActive(false)
      self.application.publish()
      setTimeout(() => {
        self.application.refreshAll()
        self.dialog.close()
      }, 2000)
    }, true)

    self.dialog = new Dialog({
      dialogId: 'publish',
      buttons: [
        self.activitySpinner,
        self.dissmissButton,
        publishButton
      ],
      title: self.__('Publishing settings'),
      dialogClass: 'modal-info'
    })
    self.dialog.setBody(content)
  }
}
/** this wizzard will create a new HAP Instance */
export class NewHAPInstanceWizzard extends Wizzard {
  constructor (application) {
    super(application)
    let self = this
    this.status = new Label()
    let content = $('<div>').append(self.__('Here you can setup a new HomeKit instance. Please give your instance a nice name (eg. Roomname)'))
    content.append('<br /><br />')
    this.grid = new Grid('newHAP', {rowStyle: 'margin-bottom:15px'})

    let newInstance = {method: 'createinstance', publish: true}
    var row = this.grid.addRow('instRow')

    let inputName = new Input('instancename', '', (e, input) => {
      newInstance.name = input.value
    })
    inputName.setGroupLabel('HomeMatic_')

    row.addCell({sm: 12, md: 3, lg: 3}, this.__('Homekit instance name:'))
    row.addCell({sm: 12, md: 9, lg: 9}, inputName.render())

    row = this.grid.addRow('roomRow')
    let ccuRoomList = this.application.getRooms()
    let oRoomList = new Dropdown('newInstanceRoom', this.__('Select a room'))
    ccuRoomList.map(room => {
      // set the current template
      oRoomList.addItem({
        title: room.name,
        value: room.id,
        onClick: async (e, btn) => {
          newInstance.roomId = btn
        }
      })
    })

    row.addCell({sm: 12, md: 3, lg: 3}, this.__('HomeMatic assigned room:'))
    row.addCell({sm: 12, md: 9, lg: 9}, oRoomList.render())

    content.append(this.grid.render())
    let finishButton = new Button('success', self.__('Finish'), async (e, btn) => {
      if (newInstance.name) {
        self.status.setLabel(self.__('Creating instance ...'))
        self.activitySpinner.setActive(true)
        self.dissmissButton.setActive(false)
        finishButton.setActive(false)
        await self.application.makeApiRequest(newInstance)
        setTimeout(() => {
          self.application.refreshBridges()
          self.dialog.close()
        }, 2000)
      } else {
        // message for missing name
        self.status.setLabel(self.__('Please fill the name'))
      }
    }, true)

    self.dialog = new Dialog({
      dialogId: 'newhapinstance',
      buttons: [
        self.status,
        self.activitySpinner,
        self.dissmissButton,
        finishButton
      ],
      title: self.__('Create new HomeKit instance'),
      dialogClass: 'modal-info'
    })
    self.dialog.setBody(content)
  }
}

export class EditHapInstanceWizzard extends Wizzard {
  constructor (application) {
    super(application)
    let self = this
    this.status = new Label()

    self.finishButton = new Button('success', self.__('Finish'), async (e, btn) => {
      if ((self.hapInstanceData.displayName !== undefined) && (self.hapInstanceData.displayName.length > 0)) {
        self.status.setLabel(self.__('Updating instance ...'))
        self.finishButton.setActive(false)
        self.activitySpinner.setActive(true)
        self.dissmissButton.setActive(false)
        await self.application.makeApiRequest(self.hapInstanceData)
        setTimeout(() => {
          self.application.refreshBridges()
          self.dialog.close()
        }, 2000)
      } else {
        self.status.setLabel(self.__('Please fill the name'))
      }
    }, true)

    self.dialog = new Dialog({
      dialogId: 'editHAP',
      buttons: [
        self.status,
        self.activitySpinner,
        self.dissmissButton,
        self.finishButton
      ],
      title: self.__('Edit Homekit instance'),
      dialogClass: 'modal-info',
      scrollable: false,
      size: 'modal-xl'
    })
  }

  run (hapInstance) {
    let self = this

    let content = $('<div>').append(self.__('Edit HAP Instance'))
    content.append('<br /><br />')
    let grid = new Grid('editHAP', {rowStyle: 'margin-bottom:15px'})

    let name = hapInstance.displayName
    if (name.indexOf('HomeMatic_') === 0) {
      name = name.replace('HomeMatic_', '')
    }
    this.hapInstanceData = {method: 'editinstance', publish: true, uuid: hapInstance.id, displayName: name, roomId: hapInstance.roomId}

    let inputName = new Input('instancedisplayName', this.hapInstanceData.displayName, (e, input) => {
      self.hapInstanceData.displayName = input.value
      if (input.value.length > 0) {
        self.finishButton.setActive(true)
      } else {
        self.finishButton.setActive(false)
      }
    })
    inputName.setGroupLabel('HomeMatic_')
    var row = grid.addRow('instRow')
    row.addCell({sm: 12, md: 3, lg: 3}, this.__('Homekit instance name:'))
    row.addCell({sm: 12, md: 9, lg: 9}, inputName.render())

    row = grid.addRow('roomRow')
    let ccuRoomList = this.application.getRooms()
    let oRoomList = new Dropdown('newInstanceRoom', this.__('Select a room'))
    ccuRoomList.map(room => {
      if (room.id === self.hapInstanceData.roomId) {
        oRoomList.setTitle(room.name)
      }

      oRoomList.addItem({
        title: room.name,
        value: room.id,
        onClick: async (e, btn) => {
          self.hapInstanceData.roomId = parseInt(btn)
        }
      })
    })

    row.addCell({sm: 12, md: 3, lg: 3}, this.__('HomeMatic assigned room:'))
    row.addCell({sm: 12, md: 9, lg: 9}, oRoomList.render())

    content.append(grid.render())
    this.dialog.setBody(content)
    this.dialog.open()
  }
}

export class DeactivateInstanceWizzard extends Wizzard {
  constructor (application) {
    super(application)
    let self = this
    this.status = new Label()

    self.finishButton = new Button('success', self.__('Deactivate'), async (e, btn) => {
      self.status.setLabel(self.__('Deactivating instance ...'))
      self.finishButton.setActive(false)
      self.activitySpinner.setActive(true)
      self.dissmissButton.setActive(false)
      await self.application.makeApiRequest(self.hapInstanceData)
      setTimeout(() => {
        self.application.refreshBridges()
        self.dialog.close()
      }, 2000)
    }, true)

    self.dialog = new Dialog({
      dialogId: 'deactivateHAP',
      buttons: [
        self.status,
        self.activitySpinner,
        self.dissmissButton,
        self.finishButton
      ],
      title: self.__('Deactivate Homekit instance'),
      dialogClass: 'modal-info',
      scrollable: false
    })
  }

  run (hapInstance) {
    let self = this

    let content = $('<div>').append(self.__('Deactivate Homekit instance'))
    content.append('<br /><br />')

    let name = hapInstance.displayName
    this.hapInstanceData = {method: 'deactivateInstance', uuid: hapInstance.id}
    content.append(self.__('If you deactivate a instance all devices in this instance will be removed from Homekit.'))
    content.append('<br />')
    content.append(self.__('The devices will stay in your configuration so they will appear again in Homekit when you activate the instance again.'))
    content.append(self.__('Use this feature to move a instance to another home without the need to assing all devices to a new room.'))
    content.append(self.__('To do this deactivate the instance, remove it from homekit, add it to a new Home, assign a room and activate the instance again.'))
    content.append('<br />')
    content.append(self.__('To activate the instance again just set the checkmark in Publishing settings.'))
    content.append('<br /><br />')
    content.append(self.__('To you want to deactivate %s', name))

    this.dialog.setBody(content)
    this.dialog.open()
  }
}

export class AbstractEditObjectWizzard extends Wizzard {
  async buildObjectSettingsUI () {
    var row = this.grid.addRow('objName')
    let self = this
    let inputName = new Input('objNameInHomeKit', this.objectData.name, (e, input) => {
      self.objectData.name = input.value
      if (input.value.length > 0) {
        self.finishButton.setActive(true)
      } else {
        self.finishButton.setActive(false)
      }
    })
    inputName.setGroupLabel(self.__('HomeKit name:'))
    row.addCell({sm: 12, md: 3, lg: 3}, this.__('HomeKit name:'))
    row.addCell({sm: 12, md: 9, lg: 9}, inputName.render())

    if (this.services) {
      let hapList = new Dropdown('newObjectServiceList', self.__('Select a service'))
      self.services.map(service => {
        if (service.serviceClazz === self.objectData.serviceClass) {
          hapList.setTitle(service.serviceClazz)
        }
        hapList.addItem({
          title: service.serviceClazz,
          value: service.serviceClazz,
          onClick: (e, btn) => {
            self.objectData.serviceClass = btn
          }
        })
      })

      row = this.grid.addRow('objService')
      row.addCell({sm: 12, md: 3}, this.__('Service'))
      row.addCell({sm: 12, md: 9}, hapList.render())
    }

    let hapList = new Dropdown('newObjectHapList', self.__('Select a instance'))
    self.application.getBridges().map(bridge => {
      if (bridge.id === self.objectData.instanceID) {
        hapList.setTitle(bridge.displayName)
      }
      hapList.addItem({
        title: bridge.displayName,
        value: bridge.id,
        onClick: (e, btn) => {
          self.objectData.instanceID = btn
        }
      })
    })

    row = this.grid.addRow('objInstance')
    row.addCell({sm: 12, md: 3}, this.__('Instance'))
    row.addCell({sm: 12, md: 9}, hapList.render())
  }
}

export class EditObjectWizzard extends AbstractEditObjectWizzard {
  constructor (application, dialogTitle) {
    super(application)
    let self = this
    this.status = new Label()
    this.dialogTitle = dialogTitle

    self.finishButton = new Button('success', self.__('Finish'), async (e, btn) => {
      if ((self.objectData.name !== undefined) && (self.objectData.name.length > 0)) {
        self.status.setLabel(self.__('Updating object ...'))
        self.finishButton.setActive(false)
        self.activitySpinner.setActive(true)
        self.dissmissButton.setActive(false)
        if (self.willSave) {
          self.willSave(self)
        }
        await self.application.makeApiRequest(self.objectData)
        setTimeout(() => {
          if (self.onClose) {
            self.onClose(self)
          }
          self.dialog.close()
        }, 2000)
      } else {
        self.status.setLabel(self.__('Please fill the name'))
      }
    }, true)

    self.dialog = new Dialog({
      dialogId: 'editObject',
      buttons: [
        self.status,
        self.activitySpinner,
        self.dissmissButton,
        self.finishButton
      ],
      title: self.dialogTitle,
      dialogClass: 'modal-info',
      scrollable: false
    })
  }

  onClose (callback) {
    this.onClose = callback
  }

  willSave (callback) {
    this.willSave = callback
  }

  setServices (services) {
    this.services = services
  }

  run (object) {
    let self = this

    let content = $('<div>').append(self.dialogTitle)
    content.append('<br /><br />')

    this.grid = new Grid('editObjectGrid', {rowStyle: 'margin-bottom:15px'})

    this.objectData = {
      serial: object.serial,
      name: object.name,
      serviceClass: object.serviceClass,
      instanceID: object.instanceID
    }
    super.buildObjectSettingsUI()
    content.append(this.grid.render())
    this.dialog.setBody(content)
    this.dialog.open()
  }
}

export class NewObjectWizzard extends AbstractEditObjectWizzard {
  constructor (application, dialogTitle, propertyTitle) {
    super(application)
    let self = this
    this.objectData = {}
    this.status = new Label()
    this.dialogTitle = dialogTitle
    this.propertyTitle = propertyTitle

    self.finishButton = new Button('success', self.__('Finish'), async (e, btn) => {
      if (self.objectData.instanceID === undefined) {
        self.status.setLabel(self.__('Please choose a HAP instance'))
      } else {
        self.finishButton.setActive(false)
        self.activitySpinner.setActive(true)
        self.dissmissButton.setActive(false)

        if (self.willSave) {
          self.willSave(self)
        }

        await self.application.makeApiRequest(self.objectData)
        setTimeout(() => {
          if (self.onClose) {
            self.onClose(self)
          }
          // self.application.refreshVariables()
          self.dialog.close()
        }, 2000)
      }
    }, false)

    self.dialog = new Dialog({
      dialogId: 'addNewObject',
      buttons: [
        self.status,
        self.activitySpinner,
        self.dissmissButton,
        self.finishButton
      ],
      title: self.dialogTitle,
      dialogClass: 'modal-info',
      scrollable: false,
      size: 'modal-xl'
    })
  }

  onClose (callback) {
    this.onClose = callback
  }

  willSave (callback) {
    this.willSave = callback
  }

  checkObjectIsMapped (callback) {
    this.objectIsMappedCheck = callback
  }

  setListTitles (titles) {
    this.listTitles = titles
  }

  setServices (services) {
    this.services = services
  }

  showObjectSettings (object, title) {
    let content = $('<div>').append(title)
    content.append('<br /><br />')

    this.grid = new Grid('editVariableGrid', {rowStyle: 'margin-bottom:15px'})

    this.objectData = {method: 'saveVariable',
      serial: object.name,
      name: object.name,
      instanceID: object.instanceID,
      serviceClass: object.serviceClass
    }
    super.buildObjectSettingsUI()
    content.append(this.grid.render())
    this.finishButton.setActive(true)
    this.dialog.setBody(content)
  }

  run (objectList) {
    let self = this
    let content = $('<div>').append(self.dialogTitle)
    content.append('<br /><br />')
    let grid = new DatabaseGrid('newObjectSelector', objectList, {maxPages: 4})

    grid.addSearchBar(self.__('Search'), self.__('Clear'), (element, filter) => {
      if (element) {
        return (((element.name) && (element.name.toLowerCase().indexOf(filter.toLowerCase()) > -1)) ||
              ((element.dpInfo) && (element.dpInfo.toLowerCase().indexOf(filter.toLowerCase()) > -1)))
      } else {
        return false
      }
    })

    grid.setTitleLabels(this.listTitles)

    grid.setColumns([
      {sz: {sm: 6, md: 5, lg: 5}, sort: 0},
      {sz: {sm: 6, md: 5, lg: 5}, sort: 1},
      {sz: {sm: 6, md: 2, lg: 2}}
    ])

    grid.sortCallback = (column, a, b) => {
      switch (column) {
        case 0:
          return a.name.localeCompare(b.name)
        case 1:
          return a.dpInfo.localeCompare(b.dpInfo)
        default:
          return true
      }
    }
    grid.columnSort = 0

    grid.setRenderer((row, item) => {
      var selectButton
      if (self.objectIsMappedCheck(item)) {
        selectButton = new Button('secondary', self.__('allready here'), (e, btn) => {})
      } else {
        selectButton = new Button('info', self.__('Select'), (e, btn) => {
          self.showObjectSettings(item)
        })
      }
      selectButton.setStyle('width:100%')
      return ([item.name, item.dpInfo, selectButton.render()])
    })

    content.append(grid.render())
    this.dialog.setBody(content)
    this.dialog.open()
  }
}
