import React, { useEffect, useState } from "react"

import { useNewTabSettings } from "../lib/settingsStore"

function getDisplayMode(value?: string) {
  if (value === "time_date") return "all"
  if (value === "time_only") return "date"
  if (value === "date_only") return "clock"
  return value || "all"
}

function getClockScale(value?: number) {
  if (!value) return 1
  return value > 3 ? value / 50 : value
}

type ClockProps = {
  onClick?: () => void
}

export default function Clock({ onClick }: ClockProps) {
  const [time, setTime] = useState(new Date())
  const [settings] = useNewTabSettings()

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!settings || settings.timeEnable === false) return null

  // Helper for timezone
  const getTimeWithTimezone = () => {
    if (settings.timeTimezone && settings.timeTimezone !== "auto") {
      try {
        const str = time.toLocaleString("en-US", {
          timeZone: settings.timeTimezone
        })
        return new Date(str)
      } catch (e) {
        return time
      }
    }
    return time
  }

  const displayTime = getTimeWithTimezone()

  const showSeconds = settings.timeShowSeconds ?? false
  const is12Hour = settings.time12HourFormat ?? false
  const clockSize = getClockScale(settings.timeClockSize)
  const displayMode = getDisplayMode(settings.timeDisplay)
  const locale = "zh-CN"

  // Format time
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: is12Hour,
    ...(showSeconds && { second: "2-digit" })
  }

  const timeString = displayTime.toLocaleTimeString(locale, timeOptions)

  // Format date
  const getFormattedDate = () => {
    return displayTime.toLocaleDateString(locale, {
      month: "long",
      day: "numeric",
      weekday: "long"
    })
  }

  const dateString = getFormattedDate()

  return (
    <div
      className={`flex select-none flex-col items-center justify-center text-white transition-opacity duration-1000 ${
        onClick ? "cursor-pointer" : ""
      }`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={onClick ? "点击刷新背景" : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick || (event.key !== "Enter" && event.key !== " ")) return
        event.preventDefault()
        onClick()
      }}
      style={{
        transform: `scale(${clockSize})`,
        transformOrigin: "center center"
      }}>
      <>
        {(displayMode === "all" || displayMode === "date") && (
          <div
            className="text-[4.5rem] tracking-[0.02em] leading-none"
            style={{ fontWeight: "var(--nh-font-weight-clock)" }}>
            {timeString}
          </div>
        )}
        {(displayMode === "all" || displayMode === "clock") && (
          <div
            className="text-base tracking-wide mt-2 opacity-90"
            style={{ fontWeight: "var(--nh-font-weight)" }}>
            {dateString}
          </div>
        )}
      </>
    </div>
  )
}
