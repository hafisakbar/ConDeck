import { Music4, Pause, Play, Plus, Square, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Panel, PanelBody, PanelHeader } from '../components/ui/Panel';
import { useSoundStore } from '../stores/sound-store';

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Pustaka Suara: the audio files a Soundboard action can play. */
export function SoundsPage() {
  const t = useT();
  const sounds = useSoundStore((state) => state.sounds);
  const status = useSoundStore((state) => state.status);
  const error = useSoundStore((state) => state.error);
  const playing = useSoundStore((state) => state.playing);
  const load = useSoundStore((state) => state.load);
  const importSounds = useSoundStore((state) => state.importSounds);
  const remove = useSoundStore((state) => state.remove);
  const togglePreview = useSoundStore((state) => state.togglePreview);
  const stopAll = useSoundStore((state) => state.stopAll);
  const clearError = useSoundStore((state) => state.clearError);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (useSoundStore.getState().status === 'idle') {
      void load();
    }
  }, [load]);

  const anyPlaying = Object.values(playing).some(Boolean);
  const target = pendingDelete ? sounds.find((sound) => sound.id === pendingDelete) : null;

  async function handleImport(): Promise<void> {
    setImporting(true);
    await importSounds();
    setImporting(false);
  }

  async function handleDelete(): Promise<void> {
    if (!pendingDelete) {
      return;
    }
    setDeleting(true);
    const ok = await remove(pendingDelete);
    setDeleting(false);
    if (ok) {
      setPendingDelete(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {error ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-panel border border-danger/40 bg-danger-soft px-4 py-3 text-xs text-danger"
        >
          <span className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </span>
          <button type="button" className="font-medium underline" onClick={clearError}>
            {t('common.close')}
          </button>
        </div>
      ) : null}

      <Panel>
        <PanelHeader
          title={t('sounds.title')}
          description={t('sounds.description')}
          action={
            <div className="flex items-center gap-2">
              {anyPlaying ? (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Square className="size-3.5" aria-hidden />}
                  onClick={stopAll}
                >
                  {t('sounds.stopAll')}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="primary"
                loading={importing}
                icon={<Plus className="size-3.5" aria-hidden />}
                onClick={() => void handleImport()}
              >
                {t('sounds.add')}
              </Button>
            </div>
          }
        />

        {sounds.length === 0 ? (
          <EmptyState
            icon={Music4}
            title={status === 'loading' ? t('common.loading') : t('sounds.emptyTitle')}
            description={t('sounds.emptyDescription')}
          >
            <Button
              variant="primary"
              loading={importing}
              onClick={() => void handleImport()}
            >
              {t('sounds.chooseFiles')}
            </Button>
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {sounds.map((sound) => {
              const isPlaying = playing[sound.id] === true;
              return (
                <li
                  key={sound.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content">{sound.name}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-content-subtle">
                      <Badge tone="neutral">{sound.format.toUpperCase()}</Badge>
                      <span>{formatSize(sound.byteSize)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={
                        isPlaying ? (
                          <Pause className="size-3.5" aria-hidden />
                        ) : (
                          <Play className="size-3.5" aria-hidden />
                        )
                      }
                      onClick={() => void togglePreview(sound.id)}
                    >
                      {isPlaying ? t('sounds.stop') : t('sounds.preview')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('sounds.delete')}
                      title={t('sounds.delete')}
                      icon={<Trash2 className="size-3.5" aria-hidden />}
                      onClick={() => setPendingDelete(sound.id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <PanelBody className="border-t border-border-subtle">
          <p className="text-[11px] leading-relaxed text-content-subtle">{t('sounds.outputNote')}</p>
        </PanelBody>
      </Panel>

      <Modal
        open={pendingDelete !== null}
        title={t('sounds.deleteTitle')}
        description={target ? t('sounds.deleteDescription', { name: target.name }) : undefined}
        onClose={() => setPendingDelete(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void handleDelete()}>
              {t('sounds.delete')}
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-content-muted">{t('sounds.deleteHint')}</p>
      </Modal>
    </div>
  );
}
