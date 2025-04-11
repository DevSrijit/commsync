import { Metadata } from "next";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export const metadata: Metadata = {
    title: "Terms of Service | CommSync",
    description: "CommSync's terms and conditions for using our platform",
};

export default function TermsOfServicePage() {
    return (
        <div className="container max-w-4xl mx-auto py-12 px-4 sm:px-6">
            <div className="flex flex-col items-center mb-8">
                <h1 className="text-3xl font-semibold tracking-tight mb-2">Terms of Service</h1>
                <p className="text-muted-foreground text-center max-w-2xl">
                    Last Updated: April 10, 2025
                </p>
                <Separator className="mt-6 mb-10 w-1/3" />
            </div>

            <Card className="p-6 mb-8 border border-border/40 shadow-sm">
                <ScrollArea className="h-[70vh] pr-4">
                    <div className="prose prose-slate max-w-none">
                        <p className="text-base leading-7">
                            Welcome to CommSync. The following User Terms and Conditions (the "Terms") describe how you may use
                            the CommSync mobile apps, websites, services, and software (collectively, "CommSync" or the "Services"),
                            provided to you by CommSync ("we," "us," or "our").
                        </p>
                        <p className="text-base leading-7 mt-4">
                            Please read these Terms carefully. They apply to anyone who accesses or uses CommSync ("users," "you," or "your").
                            By using CommSync, you agree to be bound by these Terms and by the terms of our Privacy Policy,
                            which explains how we collect, use, and protect your personal information.
                        </p>
                        <p className="text-base leading-7 mt-4">
                            If you use CommSync on behalf of a group, organization, or company, you represent that you have the authority
                            to bind that entity to these Terms (in which case, "you" and "your" refer to that entity).
                        </p>

                        <Accordion type="single" collapsible className="mt-8">
                            <AccordionItem value="what-is-commsync">
                                <AccordionTrigger className="text-xl font-medium">1. What is CommSync</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <p>
                                        CommSync is a unified communications platform that integrates multiple messaging and communication channels in one place.
                                        You may link your email provider(s), phone services (e.g., JustCall, WhatsApp), social media messaging (e.g., Instagram DMs),
                                        and other channels (e.g., Discord) so that all messages from a single lead or customer appear in one thread.
                                    </p>
                                    <ol className="list-decimal ml-6 space-y-4 mt-4">
                                        <li>
                                            When you add your accounts (email, phone, or other platforms) to CommSync, you authorize us to securely access, process,
                                            and temporarily store your messages and related data, as necessary to provide the Services.
                                        </li>
                                        <li>
                                            CommSync may securely store certain credentials to provide you with continuous integration, or use secure authentication
                                            methods offered by the respective service providers to avoid storing your passwords whenever possible.
                                        </li>
                                        <li>
                                            We may keep data temporarily on our servers to deliver CommSync's features (for example, storing recent messages or
                                            conversation histories). Although we strive to maintain reliable storage, you understand that we may delete or archive
                                            older messages after a certain period and that CommSync is not intended to be a permanent archive of your communications.
                                        </li>
                                    </ol>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="user-obligations">
                                <AccordionTrigger className="text-xl font-medium">2. User Obligations</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <p>By signing up to use CommSync, you agree to:</p>
                                    <ol className="list-decimal ml-6 space-y-4 mt-4">
                                        <li>
                                            <strong>Provide Accurate Information.</strong> You will keep your account information accurate, complete, and up-to-date.
                                        </li>
                                        <li>
                                            <strong>Safeguard Your Account.</strong> You are responsible for all activity under your CommSync account and for
                                            protecting any passwords or other credentials you use to access CommSync.
                                        </li>
                                        <li>
                                            <strong>Follow the Law.</strong> You will use CommSync only in compliance with these Terms and all applicable laws
                                            and regulations. You represent that you can form a legally binding contract where you reside.
                                        </li>
                                    </ol>

                                    <p className="mt-6">You further agree not to:</p>
                                    <ul className="list-disc ml-6 space-y-2 mt-4">
                                        <li>
                                            <strong>Violate Applicable Laws or Regulations.</strong> Don't violate any local, state, national, or international
                                            law while using CommSync.
                                        </li>
                                        <li>
                                            <strong>Breach Privacy or Defame Others.</strong> Don't violate others' privacy rights, defame, or disparage anyone.
                                        </li>
                                        <li>
                                            <strong>Interfere with Services.</strong> Don't interfere with or disrupt CommSync or its servers and networks, or
                                            circumvent any security or authentication measures.
                                        </li>
                                        <li>
                                            <strong>Access Another User's Account.</strong> Don't attempt to access an account not belonging to you without
                                            explicit permission.
                                        </li>
                                        <li>
                                            <strong>Reverse Engineer or Resell.</strong> Don't copy, distribute, modify, reverse engineer, or otherwise exploit
                                            CommSync's software or features for any unauthorized commercial purpose.
                                        </li>
                                        <li>
                                            <strong>Send Malware or Spam.</strong> Don't send viruses, malicious code, or unsolicited spam through CommSync.
                                        </li>
                                        <li>
                                            <strong>Provide Misleading or Deceptive Information.</strong> Don't impersonate someone else or misrepresent your
                                            affiliation with any person or entity.
                                        </li>
                                    </ul>

                                    <p className="mt-6">
                                        Violation of these obligations may result in suspension or termination of your access to CommSync without notice or liability.
                                        Termination of your account or cessation of your use of the Services does not relieve you of obligations you incurred
                                        under these Terms.
                                    </p>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="security-privacy">
                                <AccordionTrigger className="text-xl font-medium">3. Security and Privacy</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <p>
                                        We value your privacy and the security of your data. Please review our Privacy Policy to learn about the
                                        information we collect and how we protect it.
                                    </p>
                                    <p className="mt-4">
                                        However, no platform or service can guarantee absolute security. You acknowledge that you provide and transmit
                                        data via CommSync at your own risk, and that unauthorized third parties may, despite our best efforts, defeat
                                        our security measures.
                                    </p>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="software-license">
                                <AccordionTrigger className="text-xl font-medium">4. Software and License</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <ol className="list-decimal ml-6 space-y-4">
                                        <li>
                                            <strong>License Grant.</strong> Subject to your compliance with these Terms, we grant you a limited, non-exclusive,
                                            non-transferable, non-sublicensable, and revocable license to install and use CommSync's software for your personal
                                            or internal business use.
                                        </li>
                                        <li>
                                            <strong>Upgrades.</strong> We may release updates or new versions of CommSync from time to time. These Terms govern
                                            any such upgrades or versions, unless we specify otherwise.
                                        </li>
                                        <li>
                                            <strong>Third-Party Code.</strong> CommSync may include open-source or third-party software, which remains subject
                                            to its own license terms.
                                        </li>
                                    </ol>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="ip-rights">
                                <AccordionTrigger className="text-xl font-medium">5. CommSync's Content and Intellectual Property</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <p>
                                        We own all rights, title, and interest in and to CommSync, including but not limited to our patents, trademarks,
                                        service marks, copyrights, design elements, software, logos, and trade secrets ("CommSync Rights").
                                    </p>
                                    <ul className="list-disc ml-6 space-y-4 mt-4">
                                        <li>
                                            Nothing in these Terms grants you the right to use our trademarks, logos, domain names, or branding.
                                        </li>
                                        <li>
                                            You may provide us with feedback or suggestions, and you agree that we can use or share such feedback at any time
                                            without compensation or recognition to you.
                                        </li>
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="user-data">
                                <AccordionTrigger className="text-xl font-medium">6. Your Content and Data</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <ol className="list-decimal ml-6 space-y-4">
                                        <li>
                                            <strong>Definition of User Data.</strong> "User Data" includes any messages, information, files, images, attachments,
                                            or other content you upload, submit, or transmit through CommSync.
                                        </li>
                                        <li>
                                            <strong>Your Ownership.</strong> You retain any intellectual property rights in and to your User Data. CommSync does
                                            not claim ownership of your User Data.
                                        </li>
                                        <li>
                                            <strong>Permissions to CommSync.</strong> By using CommSync, you grant us the limited, non-exclusive, royalty-free
                                            right to (i) store and process your User Data as necessary to provide the Services, (ii) transmit or display your
                                            User Data to you or third parties at your direction, and (iii) sublicense these rights to trusted third parties who
                                            help us operate CommSync (e.g., hosting providers).
                                        </li>
                                        <li>
                                            <strong>Your Responsibility.</strong> You are solely responsible for User Data transmitted or stored through CommSync.
                                            You represent and warrant that you have all necessary rights to provide such User Data to us.
                                        </li>
                                    </ol>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="copyright">
                                <AccordionTrigger className="text-xl font-medium">7. Copyright Infringement</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <ul className="list-disc ml-6 space-y-4">
                                        <li>
                                            You are responsible for any content you share through CommSync.
                                        </li>
                                        <li>
                                            We comply with applicable intellectual property laws, including the Digital Millennium Copyright Act (DMCA).
                                        </li>
                                        <li>
                                            We reserve the right to remove or disable content alleged to be infringing and to terminate the accounts of repeat infringers.
                                        </li>
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="warranties">
                                <AccordionTrigger className="text-xl font-medium">8. Representations and Warranties</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <p>
                                        CommSync is provided on an "AS IS" and "AS AVAILABLE" basis, without warranties of any kind, either express or implied.
                                        To the maximum extent permitted by law, we and our licensors disclaim all warranties, including implied warranties of
                                        merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that CommSync will be error-free,
                                        uninterrupted, secure, or free of viruses or harmful components. You use CommSync at your own risk.
                                    </p>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="liability">
                                <AccordionTrigger className="text-xl font-medium">9. Limitation of Liability</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <p>To the fullest extent permitted by law:</p>
                                    <ul className="list-disc ml-6 space-y-4 mt-4">
                                        <li>
                                            We and our affiliates, officers, employees, agents, suppliers, or licensors shall not be liable for any indirect,
                                            special, incidental, consequential, or punitive damages (including loss of data, revenue, profits, or business) arising
                                            out of or in connection with your use of CommSync.
                                        </li>
                                        <li>
                                            Our total liability for any claims arising out of or related to these Terms or CommSync shall not exceed the amounts
                                            you have paid us (if any) for CommSync in the three (3) months preceding the event giving rise to the claim.
                                        </li>
                                    </ul>
                                    <p className="mt-4">
                                        Some jurisdictions do not allow certain limitations of liability, so these limitations may not apply to you.
                                    </p>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="indemnity">
                                <AccordionTrigger className="text-xl font-medium">10. Indemnity</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <p>
                                        You agree to defend, indemnify, and hold harmless us and our affiliates, officers, employees, agents, suppliers, or
                                        licensors from any and all claims, damages, liabilities, losses, costs, or expenses (including attorneys' fees) arising
                                        out of or related to:
                                    </p>
                                    <ol className="list-decimal ml-6 space-y-2 mt-4">
                                        <li>Your use or misuse of CommSync;</li>
                                        <li>Your violation of these Terms;</li>
                                        <li>Your violation of any third-party right, including any intellectual property or privacy right;</li>
                                        <li>Any User Data submitted through your account;</li>
                                        <li>Any other party's access to or use of CommSync through your account or credentials.</li>
                                    </ol>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="changes">
                                <AccordionTrigger className="text-xl font-medium">11. Changes and Modifications</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <p>
                                        We continuously improve and evolve CommSync. We may modify or remove features at any time, and we may update these
                                        Terms from time to time. If we make material changes, we will update the "Last Updated" date above or notify you by
                                        other means. Your continued use of CommSync after any such update constitutes your acceptance of the revised Terms.
                                        If you do not agree with any updates, you must stop using CommSync.
                                    </p>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="notifications">
                                <AccordionTrigger className="text-xl font-medium">12. Notifications</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <p>
                                        We may provide notices to you by email, via CommSync, or by posting on our website. We reserve the right to determine
                                        the form and means of providing notifications to our users. You are responsible for keeping your account information
                                        current so that you receive these notices.
                                    </p>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="governing-law">
                                <AccordionTrigger className="text-xl font-medium">13. Governing Law and Dispute Resolution</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <p>
                                        These Terms and any dispute arising out of or related to CommSync will be governed by the laws of the state of Mississippi,
                                        without regard to its conflict-of-laws principles. All claims arising out of or relating to these Terms or CommSync must be
                                        litigated exclusively in the federal or state courts located in the United States, and you consent to personal jurisdiction
                                        and venue in those courts.
                                    </p>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="miscellaneous">
                                <AccordionTrigger className="text-xl font-medium">14. Miscellaneous</AccordionTrigger>
                                <AccordionContent className="text-base leading-7 pt-4">
                                    <ol className="list-decimal ml-6 space-y-4">
                                        <li>
                                            <strong>Entire Agreement.</strong> These Terms, together with any other policies referenced herein (such as the
                                            Privacy Policy), constitute the entire agreement between you and us with respect to CommSync.
                                        </li>
                                        <li>
                                            <strong>No Third-Party Beneficiaries.</strong> These Terms do not create any rights for or in favor of any third parties.
                                        </li>
                                        <li>
                                            <strong>Waiver and Severability.</strong> Our failure to enforce any provision of these Terms does not waive our right
                                            to do so later. If any provision is found unenforceable, the remaining provisions remain fully enforceable, and a
                                            substitute provision reflecting our intent will be applied.
                                        </li>
                                        <li>
                                            <strong>Assignment.</strong> You may not assign or transfer your rights or obligations under these Terms without our
                                            prior written consent. We may freely assign these Terms.
                                        </li>
                                        <li>
                                            <strong>Relationship.</strong> You and CommSync are independent contractors; these Terms do not establish any partnership,
                                            joint venture, or agency relationship.
                                        </li>
                                    </ol>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <div className="mt-12 border-t pt-8">
                            <h2 className="text-xl font-medium mb-4">Contact Us</h2>
                            <p className="text-base leading-7">
                                If you have any questions about these Terms, please contact us at:
                            </p>
                            <p className="text-base font-medium mt-2">
                                commsync@havenmediasolutions.com
                            </p>
                        </div>
                    </div>
                </ScrollArea>
            </Card>
        </div>
    );
} 