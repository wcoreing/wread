import { useCallback, useEffect, useState } from 'react'
import { Service } from '../../bindings/wread/internal/app'

/** useSnapCaptureSettings 解读时是否保留截屏到每一页。 */
export function useSnapCaptureSettings() {
  const [keepCapture, setKeepCaptureState] = useState(false)

  useEffect(() => {
    Service.GetSnapCaptureSettings()
      .then((s) => setKeepCaptureState(s.keepCapture))
      .catch(console.error)
  }, [])

  /** setKeepCapture 切换截屏保留并写入配置。 */
  const setKeepCapture = useCallback(async (on: boolean) => {
    await Service.SetSnapKeepCapture(on)
    setKeepCaptureState(on)
  }, [])

  return { keepCapture, setKeepCapture }
}
