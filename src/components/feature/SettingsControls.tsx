"use client";

import { useState } from "react";
import { updateNotificationSetting, deleteAccount } from "@/app/actions/settings";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmSheet } from "@/components/shell/ConfirmSheet";
import { COPY } from "@/lib/constants";

export interface SettingsControlsProps {
  initialNotificationsEnabled: boolean;
}

/**
 * 設定画面の通知トグル + アカウント削除(docs/04-api-contract.md §6, FR-8.3〜8.4)。
 * トグルの即時反映と確認シートの開閉があるため 'use client'。
 */
export function SettingsControls({ initialNotificationsEnabled }: SettingsControlsProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(initialNotificationsEnabled);
  const [savingNotify, setSavingNotify] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleToggle(next: boolean) {
    setNotificationsEnabled(next);
    setSavingNotify(true);
    setNotifyError(null);

    const result = await updateNotificationSetting(next);
    setSavingNotify(false);

    if (!result.ok) {
      setNotificationsEnabled(!next);
      setNotifyError(COPY.settings.notifySaveError);
    }
  }

  async function handleDeleteConfirm() {
    setSheetOpen(false);
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);

    const result = await deleteAccount();

    // 成功時は deleteAccount 内で redirect('/login') が呼ばれ、この行には到達しない。
    if (!result.ok) {
      setDeleting(false);
      setDeleteError(result.error);
    }
  }

  return (
    <>
      <Card>
        <div className="row-toggle">
          <label className="row-toggle__label" htmlFor="settingsNotify">
            {COPY.settings.notifyLabel}
          </label>
          <input
            type="checkbox"
            className="row-toggle__input"
            id="settingsNotify"
            role="switch"
            checked={notificationsEnabled}
            disabled={savingNotify}
            onChange={(event) => void handleToggle(event.target.checked)}
          />
        </div>
        {notifyError ? (
          <p className="field__error" role="alert">
            {notifyError}
          </p>
        ) : null}
      </Card>

      <Button
        variant="danger"
        onClick={() => setSheetOpen(true)}
        disabled={deleting}
      >
        {COPY.settings.deleteAccount}
      </Button>
      <p className="text-note">{COPY.settings.deleteAccountNote}</p>
      {deleteError ? (
        <p className="field__error" role="alert">
          {deleteError}
        </p>
      ) : null}

      <ConfirmSheet
        open={sheetOpen}
        title={COPY.settings.deleteSheetTitle}
        message={COPY.settings.deleteSheetMessage}
        confirmLabel={COPY.settings.deleteSheetConfirm}
        danger
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setSheetOpen(false)}
      />
    </>
  );
}
