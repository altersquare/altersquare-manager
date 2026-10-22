"use client";

import { useState } from "react";
import { Button, Modal, inputClass } from "@/components/ui";
import { TrashIcon } from "@/components/icons";

interface ConfirmModalProps {
  title: string;
  /** Body text; the item name is rendered highlighted after it. */
  message: React.ReactNode;
  itemName?: string;
  confirmLabel?: string;
  /** false for routine actions: neutral styling, no "can't be undone". */
  destructive?: boolean;
  /** When set, the user must type this text before confirming. */
  requireTyping?: string;
  /** Extra explanation shown under the message. */
  details?: React.ReactNode;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  onSuccess: () => void;
}

/** Destructive-action confirmation. Shows request errors inline and stays open on failure. */
export function ConfirmModal({
  title,
  message,
  itemName,
  confirmLabel = "Delete",
  destructive = true,
  requireTyping,
  details,
  onConfirm,
  onClose,
  onSuccess,
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const typingOk = !requireTyping || typed.trim() === requireTyping;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <Modal
      title={title}
      tone={destructive ? "red" : "blue"}
      icon={destructive ? <TrashIcon className="w-5 h-5" /> : undefined}
      busy={loading}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={handleConfirm} loading={loading} disabled={!typingOk} autoFocus={!requireTyping}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-400">
        {message}
        {itemName && (
          <>
            {" "}
            <span className="font-mono font-medium text-gray-100 break-all">{itemName}</span>?
          </>
        )}
        {destructive && !requireTyping && " This can't be undone."}
      </p>
      {details && <div className="text-sm text-gray-400 mt-3">{details}</div>}
      {requireTyping && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (typingOk && !loading) handleConfirm();
          }}
          className="mt-4"
        >
          <label htmlFor="confirm-typing" className="block text-sm text-gray-300 mb-1.5">
            Type <span className="font-mono text-gray-100">{requireTyping}</span> to confirm
          </label>
          <input
            id="confirm-typing"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className={inputClass}
          />
        </form>
      )}
      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
    </Modal>
  );
}

