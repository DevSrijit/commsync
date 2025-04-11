import { Metadata } from "next";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

export const metadata: Metadata = {
    title: "Privacy Policy | CommSync",
    description: "How CommSync protects your privacy and personal information",
};

export default function PrivacyPolicyPage() {
    return (
        <div className="container max-w-4xl mx-auto py-12 px-4 sm:px-6">
            <div className="flex flex-col items-center mb-8">
                <h1 className="text-3xl font-semibold tracking-tight mb-2">Privacy Policy</h1>
                <p className="text-muted-foreground text-center max-w-2xl">
                    Last Updated: April 10, 2025
                </p>
                <Separator className="mt-6 mb-10 w-1/3" />
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-8">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="data">Your Data</TabsTrigger>
                    <TabsTrigger value="usage">How We Use It</TabsTrigger>
                    <TabsTrigger value="rights">Your Rights</TabsTrigger>
                </TabsList>

                <Card className="p-6 mb-8 border border-border/40 shadow-sm">
                    <TabsContent value="overview" className="mt-0">
                        <ScrollArea className="h-[70vh] pr-4">
                            <div className="space-y-6">
                                <section>
                                    <p className="text-base leading-7">
                                        CommSync ("we," "us," or "our") provides this Privacy Policy to explain our policies and
                                        procedures regarding the collection, use, and disclosure of personal information we receive
                                        when you visit the CommSync website at https://commsync.gg (the "Site"), register an account
                                        with CommSync, or use any of our related applications, services, or software (collectively,
                                        "CommSync" or the "Service").
                                    </p>
                                    <p className="text-base leading-7 mt-4">
                                        By accessing or using CommSync, registering an account, or visiting our Site, you consent to the
                                        terms and practices described in this Policy. We reserve the right to update this Policy at any
                                        time by posting a revised version on this page, clearly indicating the date of the most recent changes.
                                        We encourage you to review this Policy regularly.
                                    </p>
                                    <p className="text-base leading-7 mt-4">
                                        If you have any questions or concerns, please reach out to us at commsync@havenmediasolutions.com.
                                    </p>
                                    <p className="text-base leading-7 mt-4 font-medium">
                                        At CommSync, we take your privacy seriously. We continuously strive to protect your data and
                                        maintain a platform you can trust.
                                    </p>
                                </section>
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="data" className="mt-0">
                        <ScrollArea className="h-[70vh] pr-4">
                            <div className="space-y-6">
                                <section>
                                    <h2 className="text-xl font-medium mb-4">What Data Do We Collect?</h2>
                                    <p className="text-base leading-7 mb-4">
                                        We collect three main categories of information:
                                    </p>
                                    <ol className="list-decimal ml-6 space-y-2">
                                        <li className="text-base leading-7">Information you choose to give us</li>
                                        <li className="text-base leading-7">Information we get when you use our Services</li>
                                        <li className="text-base leading-7">Information we receive from third parties</li>
                                    </ol>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Account and Registration Information</h3>
                                    <ul className="list-disc ml-6 space-y-2">
                                        <li className="text-base leading-7">
                                            When you create an account or use CommSync, we may collect personal information such as your name,
                                            username, email address, phone number, date of birth, profile photo, mailing address, payment information,
                                            and any other information you choose to provide.
                                        </li>
                                        <li className="text-base leading-7">
                                            In some cases, you may log in through a third-party provider (e.g., a social media or identity management service).
                                            In these cases, information shared with CommSync is subject to that third party's separate terms and privacy policy.
                                        </li>
                                    </ul>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Communications Data</h3>
                                    <ul className="list-disc ml-6 space-y-2">
                                        <li className="text-base leading-7">
                                            CommSync integrates various messaging channels—including emails, phone services (e.g., JustCall, WhatsApp),
                                            social media (e.g., Instagram DMs), and other communication platforms (e.g., Discord)—to unify your conversations in one place.
                                        </li>
                                        <li className="text-base leading-7">
                                            When you connect these accounts to CommSync, you authorize us to securely access, process, and store messages and
                                            related data (such as contact lists) to provide the Service effectively.
                                        </li>
                                        <li className="text-base leading-7">
                                            We store only the data necessary to deliver the fastest experience and essential features. We may delete older
                                            messages from our servers after a certain period, and CommSync is not intended to serve as a permanent archive.
                                        </li>
                                    </ul>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Automatic Data Collection</h3>
                                    <ul className="list-disc ml-6 space-y-2">
                                        <li className="text-base leading-7">
                                            <strong>Log Data:</strong> Our servers automatically record information sent by your browser when you visit the Site.
                                            This may include your Internet Protocol (IP) address, browser type, device identifiers, the pages or features of
                                            CommSync you use, and the times you access or use CommSync.
                                        </li>
                                        <li className="text-base leading-7">
                                            <strong>Cookies:</strong> We use cookies to remember user preferences and enhance user experience. Session cookies
                                            help us understand how you interact with CommSync, and persistent cookies store your username and login password for
                                            convenient future access. You can set your browser to refuse cookies, but some functionality may become limited as a result.
                                        </li>
                                    </ul>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Active Communications</h3>
                                    <ul className="list-disc ml-6 space-y-2">
                                        <li className="text-base leading-7">
                                            When you communicate with us directly (e.g., through email, support tickets, or surveys), we may collect and store
                                            the details of your communication, including your contact information and any other personal information you choose to share.
                                        </li>
                                    </ul>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Google API Data</h3>
                                    <ul className="list-disc ml-6 space-y-2">
                                        <li className="text-base leading-7">
                                            CommSync's use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy,
                                            including the "Limited Use" requirements.
                                        </li>
                                    </ul>
                                </section>
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="usage" className="mt-0">
                        <ScrollArea className="h-[70vh] pr-4">
                            <div className="space-y-6">
                                <section>
                                    <h2 className="text-xl font-medium mb-4">How Do We Use the Data That We Collect?</h2>
                                    <p className="text-base leading-7 mb-4">
                                        We use the collected information for the following purposes:
                                    </p>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Providing and Managing Our Services</h3>
                                    <ul className="list-disc ml-6 space-y-2">
                                        <li className="text-base leading-7">
                                            To operate CommSync, authenticate users, process transactions, troubleshoot issues, and offer customer support.
                                        </li>
                                        <li className="text-base leading-7">
                                            This processing is necessary to perform our contract with you or to fulfill legitimate interests in providing and improving the Service.
                                        </li>
                                    </ul>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Communication and Marketing</h3>
                                    <ul className="list-disc ml-6 space-y-2">
                                        <li className="text-base leading-7">
                                            To send you newsletters, promotions, special offers, product updates, or other communications about CommSync's features.
                                            You can opt out of receiving such communications at any time by clicking "unsubscribe" in an email or contacting us at
                                            commsync@havenmediasolutions.com.
                                        </li>
                                        <li className="text-base leading-7">
                                            We may send you additional marketing messages only with your consent (which you can withdraw at any time).
                                        </li>
                                    </ul>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Compliance with Legal Obligations</h3>
                                    <ul className="list-disc ml-6 space-y-2">
                                        <li className="text-base leading-7">
                                            We may process your information to comply with applicable laws, regulations, legal processes, or governmental requests.
                                        </li>
                                    </ul>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Business Interests</h3>
                                    <ul className="list-disc ml-6 space-y-2">
                                        <li className="text-base leading-7">
                                            To better understand how users interact with CommSync and to ensure a secure, effective, and personalized experience.
                                        </li>
                                        <li className="text-base leading-7">
                                            To improve, develop, and protect CommSync's features and capabilities (e.g., bug fixes, new features).
                                        </li>
                                        <li className="text-base leading-7">
                                            To conduct analytics and support internal operations that help us refine our marketing and communication strategies.
                                        </li>
                                    </ul>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Data Anonymization</h3>
                                    <ul className="list-disc ml-6 space-y-2">
                                        <li className="text-base leading-7">
                                            We may anonymize, de-identify, or aggregate data for internal business purposes or to share with third parties
                                            (e.g., statistics, usage patterns). This data cannot be used to identify you.
                                        </li>
                                    </ul>

                                    <p className="text-base leading-7 mt-6 font-medium">
                                        We do not rent, sell, or monetize your personal data. CommSync also does not serve ads based on your personal information.
                                    </p>
                                </section>

                                <section className="pt-6">
                                    <h2 className="text-xl font-medium mb-4">How Is Information Disclosed?</h2>
                                    <p className="text-base leading-7 mb-4">
                                        We will only disclose your information in the following circumstances:
                                    </p>

                                    <h3 className="text-lg font-medium mt-6 mb-3">With Your Consent</h3>
                                    <ul className="list-disc ml-6 space-y-2">
                                        <li className="text-base leading-7">
                                            We may share or disclose your information if you explicitly request or authorize us to do so.
                                        </li>
                                    </ul>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Compliance with Law or Protection of Rights</h3>
                                    <ul className="list-disc ml-6 space-y-2">
                                        <li className="text-base leading-7">
                                            We may disclose information if required by law, subpoena, legal process, or governmental request. We may also
                                            share information when we believe in good faith that disclosure is necessary to protect the rights, property,
                                            or safety of CommSync, our users, or the public.
                                        </li>
                                    </ul>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Service Providers and Affiliates</h3>
                                    <ul className="list-disc ml-6 space-y-2">
                                        <li className="text-base leading-7">
                                            We employ third parties to facilitate CommSync's functionality (e.g., hosting services, payment processing).
                                            These third-party service providers have access to your information only to perform tasks on our behalf and
                                            must comply with this Privacy Policy.
                                        </li>
                                        <li className="text-base leading-7">
                                            We may share data with our affiliates, subsidiaries, or parent companies for internal administrative purposes
                                            consistent with this Policy.
                                        </li>
                                    </ul>
                                </section>
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="rights" className="mt-0">
                        <ScrollArea className="h-[70vh] pr-4">
                            <div className="space-y-6">
                                <section>
                                    <h2 className="text-xl font-medium mb-4">Your Rights and Our Commitments</h2>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Data Retention</h3>
                                    <p className="text-base leading-7">
                                        We retain personal data for as long as needed to provide our Services or as required by law. The specific duration
                                        may vary based on factors like legal requirements or the scope of your active user relationship with CommSync.
                                    </p>
                                    <ul className="list-disc ml-6 space-y-2 mt-3">
                                        <li className="text-base leading-7">
                                            <strong>Payment Information:</strong> If you choose to store payment details for subscription services, those details are
                                            managed securely by our payment provider (e.g., Stripe) and retained only as necessary for billing and dispute resolution.
                                        </li>
                                        <li className="text-base leading-7">
                                            <strong>Deletion Requests:</strong> If you request deletion of your data, we will fulfill that request in accordance with
                                            applicable laws and our contractual obligations. Some minimal data (e.g., basic account identifiers) may be retained to
                                            prevent further unwanted processing.
                                        </li>
                                    </ul>

                                    <h3 className="text-lg font-medium mt-6 mb-3">How Is Information Secured?</h3>
                                    <p className="text-base leading-7">
                                        We employ industry-standard administrative, technical, and physical safeguards to protect your personal information.
                                        However, no system is entirely foolproof, and we cannot guarantee absolute security.
                                    </p>
                                    <ul className="list-disc ml-6 space-y-2 mt-3">
                                        <li className="text-base leading-7">
                                            <strong>Encryption:</strong> Data sent and received through CommSync is secured via TLS/SSL encryption. Stored data may
                                            also be encrypted at rest using the AES-256 standard.
                                        </li>
                                        <li className="text-base leading-7">
                                            <strong>Regular Security Measures:</strong> We apply patches regularly and conduct periodic external security audits to
                                            identify and address potential vulnerabilities.
                                        </li>
                                    </ul>

                                    <h3 className="text-lg font-medium mt-6 mb-3">International Processing or Transfer</h3>
                                    <p className="text-base leading-7">
                                        Your information may be transferred to and maintained on servers located outside of your local jurisdiction, where the
                                        privacy laws may not be as protective as those in your jurisdiction. By using CommSync, you consent to the transfer of
                                        your personal data to and from the United States (or any other country in which we operate), in accordance with this
                                        Privacy Policy and applicable laws.
                                    </p>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Our Policy Toward Minors</h3>
                                    <p className="text-base leading-7">
                                        CommSync is not intended for individuals under the age of 13. We do not knowingly collect or solicit personal information
                                        from anyone under 13. If we discover that we have inadvertently collected personal information from a child under 13, we
                                        will promptly delete that information. If you believe we might have information from or about a child under 13, please
                                        contact us at commsync@havenmediasolutions.com.
                                    </p>

                                    <h3 className="text-lg font-medium mt-6 mb-3">Contact Us</h3>
                                    <p className="text-base leading-7">
                                        If you have any questions or concerns about this Privacy Policy, or if you wish to exercise any of your data protection
                                        rights, please contact us at:
                                    </p>
                                    <p className="text-base leading-7 mt-2 font-medium">
                                        Email: commsync@havenmediasolutions.com
                                    </p>
                                </section>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Card>
            </Tabs>
        </div>
    );
} 