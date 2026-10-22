/** Kind of input rendered for an extra sign-up metadata field. */
export type AuthMetadataFieldKind = 'text' | 'boolean';

/**
 * Describes an additional sign-up field, mirroring MetaDataField and BooleanMetaDataField
 * from supabase_auth_ui.
 */
export interface AuthMetadataField {
  /** Metadata key sent to the provider. */
  readonly key: string;
  readonly label?: string;
  readonly kind?: AuthMetadataFieldKind;
  readonly required?: boolean;
  readonly placeholder?: string;
}
