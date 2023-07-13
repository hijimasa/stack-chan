import Servo from 'pins/servo'
import { Maybe, Rotation } from 'stackchan/stackchan-util'
import Timer from 'timer'

const INTERVAL = 16.5

function easeInOutSine(ratio) {
  return -(Math.cos(Math.PI * ratio) - 1) / 2
}

type PWMServoDriverProps = {
  pwmPan?: number
  pwmTiltL?: number
  pwmTiltR?: number
  offsetPan?: number
  offsetTiltL?: number
  offsetTiltR?: number
}
export class PWMServo3MotorDriver {
  _pan
  _tiltL
  _tiltR
  _panRef
  _tiltRef
  _rollRef
  _driveHandler
  _range
  _offsetPan
  _offsetTiltL
  _offsetTiltR

  constructor(param: PWMServoDriverProps = {}) {
    const pwmPan = param.pwmPan ?? 5
    const pwmTiltL = param.pwmTiltL ?? 6
    const pwmTiltR = param.pwmTiltR ?? 7
    this._pan = new Servo({
      pin: pwmPan,
      min: 500,
      max: 2400,
    })
    this._tiltL = new Servo({
      pin: pwmTiltL,
      min: 500,
      max: 2400,
    })
    this._tiltR = new Servo({
      pin: pwmTiltR,
      min: 500,
      max: 2400,
    })
    this._panRef = {
      current: 0,
    }
    this._tiltRef = {
      current: 0,
    }
    this._rollRef = {
      current: 0,
    }
    this._offsetPan = param.offsetPan ?? 0
    this._offsetTiltL = param.offsetTiltL ?? 0
    this._offsetTiltR = param.offsetTiltR ?? 0
  }

  async setTorque(/* torque: boolean */): Promise<void> {
    // We cannot change torque via Stack-chan board for now.
    // torque keeps on while 5V supplied.
    return
  }

  async applyRotation(rotation: Rotation, time = 0.5): Promise<void> {
    trace(`applyPose: ${JSON.stringify(rotation)}\n`)
    if (this._driveHandler != null) {
      trace('clearing\n')
      Timer.clear(this._driveHandler)
      this._driveHandler = null
    }
    const startPan = this._panRef.current
    const startTilt = this._tiltRef.current
    const startRoll = this._rollRef.current
    const diffPan = (rotation.y * 180) / Math.PI - startPan
    const diffTilt = (rotation.p * 180) / Math.PI - startTilt
    const diffRoll = (rotation.r * 180) / Math.PI - startRoll
    let cnt = 0
    const numFrame = (time * 1000) / INTERVAL
    this._driveHandler = Timer.repeat(() => {
      if (cnt >= numFrame) {
        Timer.clear(this._driveHandler)
        this._driveHandler = null
      }
      const ratio = easeInOutSine(cnt / numFrame)
      const p = startPan + diffPan * ratio
      const t = startTilt + diffTilt * ratio
      const r = startRoll + diffRoll * ratio
      const writingPan = Math.max(Math.min(p + 90, 170), 10) + this._offsetPan
      const writingTilt = (Math.asin(40 / 10 * Math.sin(Math.max(Math.min(t, 14), -14) * Math.PI / 180)) * 180) / Math.PI
      const writingTiltL = Math.max(Math.min( writingTilt + r + 90, 175), 5) + this._offsetTiltL
      const writingTiltR = Math.max(Math.min(-writingTilt - r + 90, 175), 5) + this._offsetTiltR
      this._pan.write(writingPan)
      this._tiltL.write(writingTiltL)
      this._tiltR.write(writingTiltR)
      this._panRef.current = p
      this._tiltRef.current = t
      this._rollRef.current = r
      cnt += 1
    }, INTERVAL)
  }

  async getRotation(): Promise<Maybe<Rotation>> {
    return {
      success: true,
      value: {
        y: (Math.PI * this._panRef.current) / 180,
        p: (Math.PI * this._tiltRef.current) / 180,
        r: (Math.PI * this._rollRef.current) / 180,
      },
    }
  }
}
