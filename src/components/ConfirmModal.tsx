"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { TrashIcon } from "@/components/icons";

interface ConfirmModalProps {
  title: string;
  /** Body text; the item name is rendered highlighted after it. */
  message: React.ReactNode;
  itemName?: string;
  confirmLabel?: string;
  /** false for reversible actions: neutral styling, no "can't be undone". */
  destructive?: boolean;
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
  onConfirm,
  onClose,
  onSuccess,
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <Button variant={destructive ? "danger" : "primary"} onClick={handleConfirm} loading={loading} autoFocus>
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
            <span className="font-mono font-medium text-gray-100 break-all">{itemName}</span>
          </>
        )}
        ?{destructive && " This can't be undone."}
      </p>
      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
    </Modal>
  );
}

