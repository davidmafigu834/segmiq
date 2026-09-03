-- quotation_line_items.package_id was still FK'd to legacy quotation_packages,
-- while Command Center / commercial quoting writes commercial_packages ids.
-- That caused insert failures (then a silent legacy fallback without package linkage).

alter table public.quotation_line_items
  drop constraint if exists quotation_line_items_package_id_fkey;

alter table public.quotation_line_items
  add constraint quotation_line_items_package_id_fkey
  foreign key (package_id) references public.commercial_packages(id) on delete set null;
