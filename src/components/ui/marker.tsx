import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const markerVariants = cva(
  "group/marker relative flex w-full items-center gap-2 min-h-4 text-left text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "",
        border: "border-b border-border pb-2",
        separator:
          "before:h-px before:min-w-0 before:flex-1 before:bg-border before:mr-1 after:h-px after:min-w-0 after:flex-1 after:bg-border after:ml-1",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Marker({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof markerVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "div"

  return (
    <Comp
      data-slot="marker"
      data-variant={variant ?? "default"}
      className={cn(markerVariants({ variant }), className)}
      {...props}
    />
  )
}

function MarkerIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="marker-icon"
      aria-hidden="true"
      className={cn("shrink-0 size-4 [&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    />
  )
}

function MarkerContent({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="marker-content"
      className={cn("min-w-0 wrap-break-word", className)}
      {...props}
    />
  )
}

export { Marker, MarkerIcon, MarkerContent, markerVariants }
