// this is just a template
const path = require('path')
const HomeMaticAccessory = require(path.join(__dirname, 'HomeMaticAccessory.js'))

class HomeMaticLeakSensorAccessory extends HomeMaticAccessory {
  publishServices (Service, Characteristic) {
    var self = this
    var leakSensor = this.getService(Service.LeakSensor)

    this.state = leakSensor.getCharacteristic(Characteristic.LeakDetected)
      .on('get', (callback) => {
        self.getValue('STATE', false).then(value => {
          if (callback) {
            self.log.debug('[LSA] return status')
            callback(null, ((self.isTrue(value) || (parseInt(value) === 2))) ? 1 : 0)
          }
        })
      })

    this.state.eventEnabled = true

    this.enableLoggingService('motion')
    this.addLastActivationService(leakSensor)

    this.registerAddressForEventProcessingAtAccessory(this.buildAddress('STATE'), (newValue) => {
      self.log.debug('[LSA] Leak State event %s', newValue)
      let leakDetected = (self.isTrue(newValue)) || (parseInt(newValue) === 2)
      if (leakDetected) {
        self.state.updateValue(1, null)
        self.updateLastActivation()
        self.addLogEntry({status: leakDetected ? 1 : 0})
      } else {
        self.state.updateValue(0, null)
      }
    })
  }

  static channelTypes () {
    return ['WATERDETECTIONSENSOR']
  }
}
module.exports = HomeMaticLeakSensorAccessory
