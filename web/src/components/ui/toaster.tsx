"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        variant,
        ...props
      }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            {/* Background Hint Layer */}
            {variant === "destructive" && (
              <div className="absolute inset-0 bg-red-500/5 pointer-events-none"></div>
            )}
            {variant === "success" && (
              <div className="absolute inset-0 bg-green-500/5 pointer-events-none"></div>
            )}

            {/* Core Content */}
            <div className="flex items-center gap-4 relative z-10 w-full pr-6">
              {/* Dynamic Icon Wrapper */}
              {variant === "destructive" && (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10">
                  <AlertCircle className="h-6 w-6" />
                </div>
              )}
              {variant === "success" && (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600/10 text-indigo-600">
                  <CheckCircle className="h-6 w-6" />
                </div>
              )}
              {(variant === "default" || !variant) && (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <Info className="h-6 w-6" />
                </div>
              )}

              {/* Text Container */}
              <div className="flex flex-col flex-1 gap-0.5">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>

            {action && <div className="relative z-10">{action}</div>}
            <ToastClose className="z-10 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 group-hover:opacity-100" />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
