import { useState, type FormEvent } from 'react';
import { useAppStore } from '../../stores/app-store';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface ProfileFormProps {
  submitLabel: string;
  onCreated?: () => void;
  autoFocus?: boolean;
}

export function ProfileForm({ submitLabel, onCreated, autoFocus = false }: ProfileFormProps) {
  const createProfile = useAppStore((state) => state.createProfile);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setValidationError('Profile name is required.');
      return;
    }

    setValidationError(null);
    setSubmitting(true);
    const trimmedDescription = description.trim();
    const created = await createProfile({
      name: trimmedName,
      ...(trimmedDescription.length > 0 ? { description: trimmedDescription } : {}),
    });
    setSubmitting(false);

    if (created) {
      setName('');
      setDescription('');
      onCreated?.();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        label="Profile name"
        placeholder="Streaming"
        value={name}
        maxLength={60}
        autoFocus={autoFocus}
        error={validationError ?? undefined}
        onChange={(event) => {
          setName(event.target.value);
          if (validationError) {
            setValidationError(null);
          }
        }}
      />
      <Input
        label="Description (optional)"
        placeholder="Main OBS layout for weekly streams"
        value={description}
        maxLength={240}
        onChange={(event) => setDescription(event.target.value)}
      />
      <Button type="submit" variant="primary" loading={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
