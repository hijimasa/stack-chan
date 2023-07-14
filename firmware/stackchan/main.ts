declare const global: any

import config from 'mc/config'
import Modules from 'modules'
import { Robot, Driver, TTS, Renderer } from 'robot'
import { RS30XDriver } from 'rs30x-driver'
import { SCServoDriver } from 'scservo-driver'
import { PWMServoDriver } from 'sg90-driver'
import { PWMServo3MotorDriver } from 'sg90-3motor-driver'
import { NoneDriver } from 'none-driver'
import { TTS as LocalTTS } from 'tts-local'
import { TTS as RemoteTTS } from 'tts-remote'
import { TTS as VoiceVoxTTS } from 'tts-voicevox'
import defaultMod, { StackchanMod } from 'default-mods/mod'
import { Renderer as SimpleRenderer } from 'face-renderer'
import { Renderer as DogFaceRenderer } from 'dog-face-renderer'
import { NetworkService } from 'network-service'
import { DOMAIN } from 'consts'
import Touch from 'touch'
import Preference from 'preference'

function createRobot() {
  const drivers = new Map<string, new (param: unknown) => Driver>([
    ['scservo', SCServoDriver],
    ['pwm', PWMServoDriver],
    ['pwm-3motor', PWMServo3MotorDriver],
    ['rs30x', RS30XDriver],
    ['none', NoneDriver],
  ])
  const ttsEngines = new Map<string, new (param: unknown) => TTS>([
    ['local', LocalTTS],
    ['remote', RemoteTTS],
    ['voicevox', VoiceVoxTTS],
  ])
  const renderers = new Map<string, new (param: unknown) => Renderer>([
    ['dog', DogFaceRenderer],
    ['simple', SimpleRenderer],
  ])

  // TODO: select driver/tts/renderer by mod

  const errors: string[] = []

  // Servo Driver
  const driverKey = config.driver?.type ?? 'scservo'
  const Driver = drivers.get(driverKey)

  // TTS
  const ttsKey = config.tts?.type ?? 'local'
  const TTS = ttsEngines.get(ttsKey)

  // Renderer
  const rendererKey = config.renderer?.type ?? 'simple'
  const Renderer = renderers.get(rendererKey)

  if (!Driver || !TTS || !Renderer) {
    for (const [key, klass] of [
      [driverKey, Driver],
      [ttsKey, TTS],
      [rendererKey, Renderer],
    ]) {
      if (klass == null) {
        errors.push(`type "${key}" does not exist`)
      }
    }
    throw new Error(errors.join('\n'))
  }

  const driver = new Driver({
    ...config.driver,
  })
  const renderer = new Renderer({
    ...config.renderer,
  })
  const tts = new TTS({
    ...config.tts,
  })
  const button = globalThis.button
  const touch = !global.screen.touch && config.Touch ? new Touch() : undefined
  return new Robot({
    driver,
    renderer,
    tts,
    button,
    touch,
  })
}

async function checkAndConnectWiFi() {
  const ssid = Preference.get(DOMAIN, 'ssid')
  const password = Preference.get(DOMAIN, 'password')
  if (ssid == null || password == null) {
    return
  }
  return new Promise((resolve, reject) => {
    globalThis.network = new NetworkService({
      ssid,
      password,
    })
    globalThis.network.connect(resolve, reject)
  })
}

async function main() {
  await checkAndConnectWiFi().catch((msg) => {
    trace(`WiFi connection failed: ${msg}`)
  })
  let { onRobotCreated, onLaunch } = defaultMod
  if (Modules.has('mod')) {
    const mod = Modules.importNow('mod') as StackchanMod
    onRobotCreated = mod.onRobotCreated ?? onRobotCreated
    onLaunch = mod.onLaunch ?? onLaunch
  }
  const shouldRobotCreate = await onLaunch?.()
  if (shouldRobotCreate !== false) {
    const robot = createRobot()
    await onRobotCreated?.(robot, globalThis.device)
  }
}

main()
