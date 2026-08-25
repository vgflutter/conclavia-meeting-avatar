import AudioToolbox
import AVFoundation
import CoreAudio
import Foundation

enum PlayerError: Error, CustomStringConvertible {
  case coreAudio(OSStatus, String)
  case deviceNotFound(String)
  case missingAudioUnit

  var description: String {
    switch self {
    case let .coreAudio(status, operation):
      return "\(operation) failed with CoreAudio status \(status)"
    case let .deviceNotFound(name):
      return "Output audio device not found: \(name)"
    case .missingAudioUnit:
      return "AVAudioEngine output node has no AudioUnit"
    }
  }
}

func check(_ status: OSStatus, _ operation: String) throws {
  guard status == noErr else { throw PlayerError.coreAudio(status, operation) }
}

func deviceName(_ deviceID: AudioDeviceID) throws -> String {
  var address = AudioObjectPropertyAddress(
    mSelector: kAudioObjectPropertyName,
    mScope: kAudioObjectPropertyScopeGlobal,
    mElement: kAudioObjectPropertyElementMain
  )
  var unmanagedName: Unmanaged<CFString>?
  var size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
  try check(
    AudioObjectGetPropertyData(deviceID, &address, 0, nil, &size, &unmanagedName),
    "Read device name"
  )
  return unmanagedName?.takeUnretainedValue() as String? ?? ""
}

func allDeviceIDs() throws -> [AudioDeviceID] {
  var address = AudioObjectPropertyAddress(
    mSelector: kAudioHardwarePropertyDevices,
    mScope: kAudioObjectPropertyScopeGlobal,
    mElement: kAudioObjectPropertyElementMain
  )
  var size: UInt32 = 0
  try check(
    AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size),
    "Read audio device list size"
  )
  var devices = [AudioDeviceID](
    repeating: AudioDeviceID(kAudioObjectUnknown),
    count: Int(size) / MemoryLayout<AudioDeviceID>.size
  )
  try check(
    AudioObjectGetPropertyData(
      AudioObjectID(kAudioObjectSystemObject),
      &address,
      0,
      nil,
      &size,
      &devices
    ),
    "Read audio device list"
  )
  return devices
}

func unmuteAndNormalize(_ deviceID: AudioDeviceID) {
  for scope in [
    kAudioObjectPropertyScopeGlobal,
    kAudioDevicePropertyScopeInput,
    kAudioDevicePropertyScopeOutput,
  ] {
    for element in UInt32(0)...UInt32(16) {
      var muteAddress = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyMute,
        mScope: scope,
        mElement: element
      )
      if AudioObjectHasProperty(deviceID, &muteAddress) {
        var settable = DarwinBoolean(false)
        if AudioObjectIsPropertySettable(deviceID, &muteAddress, &settable) == noErr, settable.boolValue {
          var unmuted: UInt32 = 0
          _ = AudioObjectSetPropertyData(
            deviceID,
            &muteAddress,
            0,
            nil,
            UInt32(MemoryLayout<UInt32>.size),
            &unmuted
          )
        }
      }

      var volumeAddress = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyVolumeScalar,
        mScope: scope,
        mElement: element
      )
      if AudioObjectHasProperty(deviceID, &volumeAddress) {
        var settable = DarwinBoolean(false)
        if AudioObjectIsPropertySettable(deviceID, &volumeAddress, &settable) == noErr, settable.boolValue {
          var fullVolume: Float32 = 1
          _ = AudioObjectSetPropertyData(
            deviceID,
            &volumeAddress,
            0,
            nil,
            UInt32(MemoryLayout<Float32>.size),
            &fullVolume
          )
        }
      }
    }
  }
}

do {
  let arguments = Array(CommandLine.arguments.dropFirst())
  guard arguments.count == 2 else {
    FileHandle.standardError.write(Data("Usage: coreaudio-play <device-name> <audio-file>\n".utf8))
    exit(64)
  }
  let requestedName = arguments[0]
  let audioURL = URL(fileURLWithPath: arguments[1])
  guard let deviceID = try allDeviceIDs().first(where: {
    (try? deviceName($0)) == requestedName
  }) else {
    throw PlayerError.deviceNotFound(requestedName)
  }
  unmuteAndNormalize(deviceID)

  let engine = AVAudioEngine()
  let player = AVAudioPlayerNode()
  engine.attach(player)
  let outputNode = engine.outputNode
  guard let audioUnit = outputNode.audioUnit else { throw PlayerError.missingAudioUnit }
  var mutableDeviceID = deviceID
  try check(
    AudioUnitSetProperty(
      audioUnit,
      kAudioOutputUnitProperty_CurrentDevice,
      kAudioUnitScope_Global,
      0,
      &mutableDeviceID,
      UInt32(MemoryLayout<AudioDeviceID>.size)
    ),
    "Select output device"
  )

  let file = try AVAudioFile(forReading: audioURL)
  engine.connect(player, to: engine.mainMixerNode, format: file.processingFormat)
  try engine.start()
  let finished = DispatchSemaphore(value: 0)
  player.scheduleFile(file, at: nil, completionCallbackType: .dataPlayedBack) { _ in
    finished.signal()
  }
  player.play()
  finished.wait()
  player.stop()
  engine.stop()
} catch {
  FileHandle.standardError.write(Data("\(error)\n".utf8))
  exit(1)
}
