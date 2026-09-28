"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextareaField } from "@/components/ui/field";
import type { FullProfile } from "@/lib/profile/repository";
import {
  addBulletAction,
  addExperienceAction,
  addSkillGroupAction,
  saveHeaderAction,
  type ActionState,
} from "./actions";

function ErrorLine({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="type-caption text-danger">
      {message}
    </p>
  );
}

export function HeaderForm({ profile }: { profile: FullProfile }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveHeaderAction,
    {},
  );
  const [contacts, setContacts] = useState(
    profile.contacts.length ? profile.contacts : [{ label: "", url: "" }],
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <ErrorLine message={state.error} />

      <Field
        id="fullName"
        name="fullName"
        label="Full name"
        defaultValue={profile.fullName}
        required
        disabled={pending}
      />
      <Field
        id="headline"
        name="headline"
        label="Headline"
        placeholder="Exact Job Title | Stack | Specialty"
        defaultValue={profile.headline ?? ""}
        disabled={pending}
      />
      <Field
        id="locationLine"
        name="locationLine"
        label="Location line"
        placeholder="Remote-First (US Timezone Aligned)"
        defaultValue={profile.locationLine ?? ""}
        disabled={pending}
      />
      <TextareaField
        id="summary"
        name="summary"
        label="Summary"
        rows={4}
        defaultValue={profile.summary ?? ""}
        disabled={pending}
      />

      <div className="flex flex-col gap-4">
        <span className="type-caption text-muted">Contacts</span>
        {contacts.map((contact, index) => (
          <div key={index} className="grid grid-cols-2 gap-4">
            <Field
              id={`contactLabel-${index}`}
              name="contactLabel"
              label="Label"
              defaultValue={contact.label}
              placeholder="GitHub"
              disabled={pending}
            />
            <Field
              id={`contactUrl-${index}`}
              name="contactUrl"
              label="URL"
              defaultValue={contact.url}
              placeholder="https://github.com/you"
              disabled={pending}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setContacts((c) => [...c, { label: "", url: "" }])}
          className="type-caption self-start text-link underline"
        >
          Add contact
        </button>
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving" : "Save"}
      </Button>
    </form>
  );
}

export function AddExperienceForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addExperienceAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <ErrorLine message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="company" name="company" label="Company" required disabled={pending} />
        <Field id="title" name="title" label="Title" required disabled={pending} />
        <Field id="location" name="location" label="Location" disabled={pending} />
        <Field
          id="about"
          name="about"
          label="About the company"
          placeholder="One sentence, renders italic"
          disabled={pending}
        />
        <Field
          id="startDate"
          name="startDate"
          label="Start"
          type="month"
          required
          disabled={pending}
        />
        <Field
          id="endDate"
          name="endDate"
          label="End (blank = present)"
          type="month"
          disabled={pending}
        />
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Adding" : "Add role"}
      </Button>
    </form>
  );
}

export function AddBulletForm({ experienceId }: { experienceId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addBulletAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="experienceId" value={experienceId} />
      <ErrorLine message={state.error} />
      <Field
        id={`text-${experienceId}`}
        name="text"
        label="Bullet — 90–105 characters, **bold** the metrics"
        required
        disabled={pending}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`linkLabel-${experienceId}`}
          name="linkLabel"
          label="Link label"
          placeholder="View Project"
          disabled={pending}
        />
        <Field
          id={`linkUrl-${experienceId}`}
          name="linkUrl"
          label="Link URL"
          disabled={pending}
        />
      </div>
      <label className="type-caption flex items-center gap-2 text-muted">
        <input type="checkbox" name="inBank" disabled={pending} />
        Keep in the bullet bank
      </label>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Adding" : "Add bullet"}
      </Button>
    </form>
  );
}

export function AddSkillGroupForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addSkillGroupAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <ErrorLine message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="category"
          name="category"
          label="Group"
          placeholder="Frontend"
          required
          disabled={pending}
        />
        <Field
          id="skills"
          name="skills"
          label="Skills, comma separated — concrete tools only"
          placeholder="typescript, react, playwright"
          required
          disabled={pending}
        />
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Adding" : "Add group"}
      </Button>
    </form>
  );
}
