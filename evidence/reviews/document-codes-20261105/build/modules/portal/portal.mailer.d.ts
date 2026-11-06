export declare class PortalMailer {
    private createTransport;
    sendCode(email: string, code: string): Promise<void>;
    sendPasswordReset(email: string, link: string): Promise<void>;
    sendSupplementReminder(email: string, applicationCode: string): Promise<void>;
}
