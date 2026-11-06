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
import { formatDateTime } from '../lib/format';
import { useAppStore } from '../stores/app-store';

export function ProfilesPage() {
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
      setFormError('Profile name is required.');
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
        <PanelHeader
          title="Profiles"
          description="The active profile supplies the deck used by desktop and mobile."
        />
        {profiles.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No profiles yet"
            description="Create your first profile to start organising decks."
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {profiles.map((profile) => (
              <li key={profile.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-content">{profile.name}</p>
                    {profile.isActive ? <Badge tone="success">Active</Badge> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-content-muted">
                    {profile.description ?? 'No description'}
                  </p>
                  <p className="mt-1 text-[11px] text-content-subtle">
                    Created {formatDateTime(profile.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(profile)}
                    aria-label={`Edit ${profile.name}`}
                    title="Edit profile"
                    className="grid size-7 place-items-center rounded-control text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(profile)}
                    aria-label={`Delete ${profile.name}`}
                    title="Delete profile"
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
                    {profile.isActive ? 'In use' : 'Set active'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="New profile" description="Each profile keeps its own deck and pages." />
        <PanelBody>
          <ProfileForm submitLabel="Create profile" />
        </PanelBody>
      </Panel>

      <Modal
        open={editing !== null}
        title="Edit profile"
        description="Renaming a profile does not touch its decks."
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void saveEdit()}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Profile name"
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
            label="Description (optional)"
            value={description}
            maxLength={240}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        title="Delete profile"
        description={deleting ? `"${deleting.name}" and everything inside it will be removed.` : undefined}
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
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
              Delete profile
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-content-muted">
          Its decks, pages and buttons are deleted as well. If this profile is active, the oldest
          remaining profile becomes active. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
