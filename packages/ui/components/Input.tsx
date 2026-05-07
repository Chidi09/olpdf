import React from "react";
import { cn } from "../utils";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export function Input({ prefix, suffix, className, ...props }: InputProps) {
  return (
    <label className={cn("flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 transition-shadow focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:border-transparent", className)}>
      {prefix}
      <input {...props} className="w-full bg-transparent text-sm outline-none" />
      {suffix}
    </label>
  );
}

export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "prefix"> {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export function Textarea({ prefix, suffix, className, ...props }: TextareaProps) {
  return (
    <div className={cn("flex gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 transition-shadow focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:border-transparent", className)}>
      {prefix}
      <textarea {...props} className="w-full min-h-20 resize-y bg-transparent text-sm outline-none" />
      {suffix}
    </div>
  );
}
