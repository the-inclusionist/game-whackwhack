// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/types — the shape every catalogue has to satisfy.

export type LocaleCode = 'pt' | 'en' | 'es';

/** Grammatical gender, matching the engine contract's `Speakable`. */
export type Gender = 'm' | 'f' | 'n';

/**
 * A flat key-to-string map.
 *
 * Flat rather than nested on purpose: a nested catalogue makes the completeness test walk two
 * shapes and compare them, and the thing that actually goes wrong is a key present in pt and
 * missing in es. Flat makes that a set difference.
 */
export type Catalog = Readonly<Record<string, string>>;
