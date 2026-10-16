"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/app/lib/utils";

const ACTION_WIDTH = 76;
const OPEN_THRESHOLD = 48;

interface SwipeableRowProps {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel: string;
  deleteLabel: string;
  className?: string;
  /** Opaque fill so actions don’t show through while dragging */
  contentClassName?: string;
}

/**
 * Swipe right → Edit, swipe left → Delete (iOS Mail-style).
 */
export function SwipeableRow({
  children,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
  className,
  contentClassName = "bg-[var(--background)]",
}: SwipeableRowProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const axis = useRef<"x" | "y" | null>(null);
  const offsetRef = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);

  const min = onDelete ? -ACTION_WIDTH : 0;
  const max = onEdit ? ACTION_WIDTH : 0;

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    const closeIfOutside = (event: PointerEvent) => {
      if (!rowRef.current?.contains(event.target as Node)) {
        setOffset(0);
      }
    };
    document.addEventListener("pointerdown", closeIfOutside);
    return () => document.removeEventListener("pointerdown", closeIfOutside);
  }, []);

  if (!onEdit && !onDelete) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={rowRef}
      className={cn("relative overflow-hidden touch-pan-y", className)}
    >
      <div className="absolute inset-y-0 left-0 flex items-stretch" aria-hidden>
        {onEdit && (
          <button
            type="button"
            onClick={() => {
              setOffset(0);
              onEdit();
            }}
            className="w-[76px] bg-primary text-white text-xs font-semibold flex items-center justify-center"
          >
            {editLabel}
          </button>
        )}
      </div>
      <div className="absolute inset-y-0 right-0 flex items-stretch" aria-hidden>
        {onDelete && (
          <button
            type="button"
            onClick={() => {
              setOffset(0);
              onDelete();
            }}
            className="w-[76px] bg-[#c45c5c] text-white text-xs font-semibold flex items-center justify-center"
          >
            {deleteLabel}
          </button>
        )}
      </div>

      <div
        className={cn(
          "relative z-10 will-change-transform",
          contentClassName
        )}
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: dragging ? "none" : "transform 0.2s ease-out",
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          startX.current = e.clientX;
          startY.current = e.clientY;
          startOffset.current = offsetRef.current;
          axis.current = null;
          setDragging(true);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const dx = e.clientX - startX.current;
          const dy = e.clientY - startY.current;
          if (axis.current === null) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
            if (axis.current === "y") {
              setDragging(false);
              return;
            }
          }
          if (axis.current !== "x") return;
          e.preventDefault();
          const next = Math.min(max, Math.max(min, startOffset.current + dx));
          setOffset(next);
        }}
        onPointerUp={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          e.currentTarget.releasePointerCapture(e.pointerId);
          const wasHorizontal = axis.current === "x";
          const current = offsetRef.current;
          axis.current = null;
          setDragging(false);
          if (!wasHorizontal) return;
          if (current > OPEN_THRESHOLD && onEdit) setOffset(ACTION_WIDTH);
          else if (current < -OPEN_THRESHOLD && onDelete)
            setOffset(-ACTION_WIDTH);
          else setOffset(0);
        }}
        onPointerCancel={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
          axis.current = null;
          setDragging(false);
          setOffset(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}
