import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card not-dark:bg-clip-padding text-card-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className,
      )}
      {...props}
    />
  )
}

function CardFrame({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-frame"
      className={cn(
        "[--clip-top:-1rem] [--clip-bottom:-1rem] *:data-[slot=card]:first:[--clip-top:1px] *:data-[slot=card]:last:[--clip-bottom:1px] flex flex-col relative rounded-2xl border bg-card before:bg-muted/72 not-dark:bg-clip-padding text-card-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)] *:data-[slot=card]:-m-px *:not-last:data-[slot=card]:rounded-b-xl *:not-last:data-[slot=card]:before:rounded-b-[calc(var(--radius-xl)-1px)] *:not-first:data-[slot=card]:rounded-t-xl *:not-first:data-[slot=card]:before:rounded-t-[calc(var(--radius-xl)-1px)] *:data-[slot=card]:[clip-path:inset(var(--clip-top)_1px_var(--clip-bottom)_1px_round_calc(var(--radius-2xl)-1px))] *:data-[slot=card]:shadow-none *:data-[slot=card]:before:hidden *:data-[slot=card]:bg-clip-padding",
        className,
      )}
      {...props}
    />
  )
}

function CardFrameHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-frame-header"
      className={cn("relative flex flex-col px-6 py-4", className)}
      {...props}
    />
  )
}

function CardFrameTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-frame-title"
      className={cn("font-semibold text-sm", className)}
      {...props}
    />
  )
}

function CardFrameDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-frame-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardFrameFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-frame-footer"
      className={cn("px-6 py-4", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 p-6 in-[[data-slot=card]:has(>[data-slot=card-panel])]:pb-4 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-semibold text-lg leading-none", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end inline-flex",
        className,
      )}
      {...props}
    />
  )
}

function CardPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-panel"
      className={cn(
        "flex-1 p-6 in-[[data-slot=card]:has(>[data-slot=card-header]:not(.border-b))]:pt-0 in-[[data-slot=card]:has(>[data-slot=card-footer]:not(.border-t))]:pb-0",
        className,
      )}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center p-6 in-[[data-slot=card]:has(>[data-slot=card-panel])]:pt-4",
        className,
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardFrame,
  CardFrameHeader,
  CardFrameTitle,
  CardFrameDescription,
  CardFrameFooter,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardPanel as CardContent,
  CardTitle,
}
