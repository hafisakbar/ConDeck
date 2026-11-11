import { Layers, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Profile } from '@condeck/shared';
import { ProfileForm } from '../components/profiles/ProfileForm';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Panel, PanelBody, PanelHeader } from '../components/ui/Panel';
import { useT } from '../i18n';
import { formatDateTime } from '../lib/format';
import { useAppStore } from '../stores/app-store';

export function ProfilesPage() {
  const t = useT();
  const profiles = useAppStore((state) => state.profiles);
  const busyProfileId = useAppStore((state) => state.busyProfileId);
  const activateProfile = useAppStore((state) => state.activateProfile);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const deleteProfile = useAppStore((state) => state.deleteProfile);

  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openEdit(profile: Profile) {
    setEditing(profile);
    setName(profile.name);
    setDescription(profile.description ?? '');
    setFormError(null);
  }

  async function saveEdit() {
    if (!editing) {
      return;
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setFormError(t('profiles.nameRequired'));
      return;
    }

    setSaving(true);
    const trimmedDescription = description.trim();
    const ok = await updateProfile({
      profileId: editing.id,
      name: trimmed,
      description: trimmedDescription.length > 0 ? trimmedDescription : null,
    });
    setSaving(false);
    if (ok) {
      setEditing(null);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Panel className="xl:col-span-2">
        <PanelHeader title={t('profiles.title')} description={t('profiles.description')} />
        {profiles.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={t('profiles.emptyTitle')}
            description={t('profiles.emptyDescription')}
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {profiles.map((profile) => (
              <li key={profile.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-content">{profile.name}</p>
                    {profile.isActive ? <Badge tone="success">{t('profiles.active')}</Badge> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-content-muted">
                    {profile.description ?? t('profiles.noDescription')}
                  </p>
                  <p className="mt-1 text-[11px] text-content-subtle">
                    {t('profiles.created', { date: formatDateTime(profile.createdAt) })}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(profile)}
                    aria-label={`${t('profiles.edit')}: ${profile.name}`}
                    title={t('profiles.edit')}
                    className="grid size-7 place-items-center rounded-control text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(profile)}
                    aria-label={`${t('profiles.delete')}: ${profile.name}`}
                    title={t('profiles.delete')}
                    className="grid size-7 place-items-center rounded-control text-content-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                  <Button
                    size="sm"
                    disabled={profile.isActive}
                    loading={busyProfileId === profile.id}
                    onClick={() => void activateProfile(profile.id)}
                  >
                    {profile.isActive ? t('profiles.inUse') : t('profiles.setActive')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title={t('profiles.newTitle')} description={t('profiles.newDescription')} />
        <PanelBody>
          <ProfileForm submitLabel={t('profiles.createProfile')} />
        </PanelBody>
      </Panel>

      <Modal
        open={editing !== null}
        title={t('profiles.editTitle')}
        description={t('profiles.editDescription')}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void saveEdit()}>
              {t('profiles.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label={t('profiles.name')}
            value={name}
            maxLength={60}
            autoFocus
            error={formError ?? undefined}
            onChange={(event) => {
              setName(event.target.value);
              if (formError) {
                setFormError(null);
              }
            }}
          />
          <Input
            label={t('profiles.descriptionLabel')}
            value={description}
            maxLength={240}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        title={t('profiles.deleteTitle')}
        description={
          deleting ? t('profiles.deleteDescription', { name: deleting.name }) : undefined
        }
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={deleting !== null && busyProfileId === deleting.id}
              onClick={() => {
                if (!deleting) {
                  return;
                }
                void deleteProfile(deleting.id).then((ok) => {
                  if (ok) {
                    setDeleting(null);
                  }
                });
              }}
            >
              {t('profiles.delete')}
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-content-muted">{t('profiles.deleteBody')}</p>
      </Modal>
    </div>
  );
}
