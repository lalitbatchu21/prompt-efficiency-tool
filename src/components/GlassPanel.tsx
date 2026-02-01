import React from "react";

type GlassPanelProps = React.HTMLAttributes<HTMLDivElement>;

export function GlassPanel({
  className,
  ...props
}: GlassPanelProps) {
  const classes =
    "bg-white/10 backdrop-blur-lg border border-white/20 shadow-xl";
  return <div className={[classes, className].filter(Boolean).join(" ")} {...props} />;
}
