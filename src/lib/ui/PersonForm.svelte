<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { api } from '#lib/api';
	import { changed, confirmDialog, toast } from '#lib/stores.svelte';
	import Button from './Button.svelte';
	import Field from './Field.svelte';
	import type { Person } from '#lib/types';

	let { person, onDone }: { person?: Person; onDone: (id?: string) => void } = $props();

	const init = untrack(() => person);
	let name = $state(init?.name ?? '');
	let phone = $state(init?.phone ?? '');
	let note = $state(init?.note ?? '');

	async function save(e: SubmitEvent) {
		e.preventDefault();
		const body = { name, phone: phone.trim() || null, note: note.trim() || null };
		let id = person?.id;
		if (id) await api.put(`people/${id}`, body);
		else id = (await api.post('people', body)).id;
		toast('Saved');
		await changed();
		onDone(id);
	}
	async function archive() {
		if (!person) return;
		await api.put(`people/${person.id}`, { archived: person.archived ? 0 : 1 });
		await changed();
		onDone(person.id);
	}
	async function remove() {
		if (!person || !(await confirmDialog(`Delete ${person.name}?`, 'Past entries stay in Activity, but their balance will no longer be tracked.'))) return;
		await api.del(`people/${person.id}`);
		await changed();
		onDone();
		goto('/plan/people');
	}
</script>

<form class="space-y-4" onsubmit={save}>
	<Field label="Name"><input class="nb-input" bind:value={name} required maxlength="60" placeholder="e.g. Rahim, Ammu, Roommate" /></Field>
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<Field label="Phone (optional)"><input class="nb-input" type="tel" bind:value={phone} maxlength="30" placeholder="01XXXXXXXXX" /></Field>
		<Field label="Note (optional)"><input class="nb-input" bind:value={note} maxlength="200" /></Field>
	</div>
	<div class="flex flex-wrap gap-3">
		{#if person}
			<Button variant="danger" onclick={remove}>Delete</Button>
			<Button onclick={archive}>{person.archived ? 'Restore' : 'Archive'}</Button>
		{/if}
		<Button variant="primary" type="submit" class="flex-1">Save</Button>
	</div>
</form>
