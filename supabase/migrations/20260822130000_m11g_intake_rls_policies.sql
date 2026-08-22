-- DTH-M11G minimal RLS policies for public intake workload proof
-- PURPOSE=Allow dth_grp_public_intake to exercise granted table ACL under RLS
-- DOES_NOT=add policies for worker/ops (no RLS on their primary paths yet)
-- HANDOFF=full RLS completion remains M11L/M

BEGIN;

DROP POLICY IF EXISTS dth_m11g_intake_leads_select ON public.leads;
CREATE POLICY dth_m11g_intake_leads_select ON public.leads
  FOR SELECT TO dth_grp_public_intake USING (true);

DROP POLICY IF EXISTS dth_m11g_intake_leads_insert ON public.leads;
CREATE POLICY dth_m11g_intake_leads_insert ON public.leads
  FOR INSERT TO dth_grp_public_intake WITH CHECK (true);

DROP POLICY IF EXISTS dth_m11g_intake_outbox_select ON public.transactional_outbox;
CREATE POLICY dth_m11g_intake_outbox_select ON public.transactional_outbox
  FOR SELECT TO dth_grp_public_intake USING (true);

DROP POLICY IF EXISTS dth_m11g_intake_outbox_insert ON public.transactional_outbox;
CREATE POLICY dth_m11g_intake_outbox_insert ON public.transactional_outbox
  FOR INSERT TO dth_grp_public_intake WITH CHECK (true);

DROP POLICY IF EXISTS dth_m11g_intake_outbox_update ON public.transactional_outbox;
CREATE POLICY dth_m11g_intake_outbox_update ON public.transactional_outbox
  FOR UPDATE TO dth_grp_public_intake USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS dth_m11g_intake_audit_insert ON public.audit_events;
CREATE POLICY dth_m11g_intake_audit_insert ON public.audit_events
  FOR INSERT TO dth_grp_public_intake WITH CHECK (true);

COMMIT;
