# A13-08 Public Intake Integration

`acceptLeadWithAcquisition` calls `acceptBusinessLeadAtomic` first, then soft-attributes. Invalid/forged refs → lead accepted, no campaign credit. Client budget/account/attribution fields ignored.
