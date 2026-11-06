import { AssignmentsService } from './assignments.service';
import { ReassignOfficerDto } from './dto/reassign-officer.dto';
export declare class AssignmentsController {
    private readonly assignmentsService;
    constructor(assignmentsService: AssignmentsService);
    getOfficerWorkloads(): Promise<any[]>;
    getAssignmentHistory(applicationId: string): Promise<({
        fromUser: {
            id: string;
            username: string;
            fullName: string;
        } | null;
        toUser: {
            id: string;
            username: string;
            fullName: string;
        };
        manager: {
            id: string;
            username: string;
            fullName: string;
        };
    } & {
        id: string;
        applicationId: string;
        reason: string | null;
        clientRequestId: string | null;
        payloadHash: string | null;
        assignmentChangeRequestId: string | null;
        reassignedAt: Date;
        fromUserId: string | null;
        toUserId: string;
        reassignedBy: string;
    })[]>;
    reassign(applicationId: string, dto: ReassignOfficerDto, managerId: string): Promise<{
        assignment: any;
        loan: any;
        replayed: boolean;
        prediction: {
            status: string;
            message: any;
        };
    }>;
}
