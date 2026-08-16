# Case / Workflow Handoff

Worker: processOneBusinessLeadHandoff / drainLeadHandoffs

Steps: control gate → claim → load lead → create/find case → start/find workflow+job → ack event.

SOURCE_LEAD_STATUS=new  
CASE_INITIAL_STATUS=open  
WORKFLOW_TYPE=B2B_INBOUND_CUSTOMER  
FIRST_JOB=B2B_QUALIFICATION_START
