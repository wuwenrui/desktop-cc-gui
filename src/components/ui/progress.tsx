import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn("flex w-full flex-col gap-2", className)}
      {...props}
    >
      {children ? (
        children
      ) : (
        <ProgressTrack>
          <ProgressIndicator
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
          />
        </ProgressTrack>
      )}
    </ProgressPrimitive.Root>
  )
}

function ProgressLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="progress-label"
      className={cn("font-medium text-sm", className)}
      {...props}
    />
  )
}

function ProgressTrack({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="progress-track"
      className={cn(
        "block h-1.5 w-full overflow-hidden rounded-full bg-input",
        className
      )}
      {...props}
    />
  )
}

function ProgressIndicator({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Indicator>) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        "h-full w-full bg-primary transition-all duration-500",
        className
      )}
      {...props}
    />
  )
}

function ProgressValue({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="progress-value"
      className={cn("text-sm tabular-nums", className)}
      {...props}
    />
  )
}

export {
  Progress,
  ProgressLabel,
  ProgressTrack,
  ProgressIndicator,
  ProgressValue,
}
