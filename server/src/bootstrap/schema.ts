export type BootstrapScope = {
  type: string;
  id: string | null;
  label: string | null;
};

export type BootstrapResponse = {
  contract_version: "1";
  profile: { id: string; display_name: string };
  roles: string[];
  permissions: string[];
  scopes: BootstrapScope[];
  school: { id: string; name: string };
  academic_year: null | { id: string; label: string };
  features: string[];
  offline_policy: { max_offline_hours: number };
};
