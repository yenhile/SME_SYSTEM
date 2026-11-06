"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREDICTION_PA1_MESSAGE = void 0;
exports.predictionStatusOf = predictionStatusOf;
exports.firstStagePolicies = firstStagePolicies;
const sla_policy_1 = require("../workflow/sla/sla-policy");
exports.PREDICTION_PA1_MESSAGE = 'Chưa có dự báo tương thích PA1.';
function predictionStatusOf(hasPrediction, firstStagePolicy) {
    if (firstStagePolicy === sla_policy_1.SLA_POLICY_PA1)
        return 'INCOMPATIBLE_PA1';
    return hasPrediction ? 'AVAILABLE' : 'NONE';
}
async function firstStagePolicies(db, applicationIds) {
    if (!applicationIds.length)
        return new Map();
    const rows = await db.applicationStageHistory.findMany({
        where: { applicationId: { in: applicationIds }, stage: { stageCode: 'TIEP_NHAN' } },
        select: { applicationId: true, slaPolicy: true },
        orderBy: { enteredAt: 'asc' },
    });
    const policies = new Map();
    for (const row of rows)
        if (!policies.has(row.applicationId))
            policies.set(row.applicationId, row.slaPolicy);
    return policies;
}
//# sourceMappingURL=prediction-status.js.map