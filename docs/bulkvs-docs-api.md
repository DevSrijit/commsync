# BulkVS API Documentation

## Prerequisites

Before using the BulkVS API, ensure you've completed these setup steps:

1. **Enable SMS/MMS on your numbers**  
   Navigate to "Inbound -> DIDs - Manage", select your number(s), and enable SMS and/or MMS capabilities.

2. **Configure webhooks for inbound messages**  
   If you want to receive inbound messages:
   - Go to "Messaging -> Message Webhook"
   - Create a webhook and set the endpoint URL
   - Apply this webhook to your numbers under "Inbound -> DIDs - Manage"

## Frequently Asked Questions

### What is an SMS Message?

An SMS message is a message going or coming from and to a single number with no attachment (ex: picture).

### What is an MMS Message?

An MMS message is a message going or coming from and to multiple numbers and/or a message with an attachment.

### Do you support short codes and do I have to do anything special?

Yes, we support short codes for SMS (not MMS). Short codes are sent and received the same way as regular numbers.

### What IP addresses will I receive messages from?

You will receive messages from `52.206.134.245` or `192.9.236.42`.

## Campaign Registration Requirements

### Outbound Toll Messaging

The messaging industry has implemented changes to SMS/MMS messaging:

- You need to register a campaign to send SMS messages
- One-time cost: $30.00
- Monthly cost: $6.00 per campaign
- Each campaign covers up to 49 telephone numbers
- Suitable for 10-15,000 messages per month
- Only applies to regular telephone numbers (not Toll-Free)

To register, fill out the form and email it to [support@bulkvs.com](mailto:support@bulkvs.com).

### Outbound Toll Free Messaging

Volume limits for Pending 8XX Toll-Free numbers:

- Daily limit: 2,000
- Weekly limit: 6,000
- Monthly limit: 10,000

There is no cost for this application. Fill out the form and email it to [support@bulkvs.com](mailto:support@bulkvs.com).

## 3CX Messaging Integration

You can send and receive messages using your Bulk Solutions numbers directly through 3CX.

### Outbound Setup

1. Find your Basic Auth Header API Key:
   - Go to Bulk Solutions Portal -> API -> API Credentials -> Rest API -> Basic Auth Header
2. In 3CX:
   - Navigate to SIP Trunks -> (YOUR TRUNK NAME) -> SMS
   - API Key: (Your Basic Auth Header)
   - Provider URL: `https://portal.bulkvs.com/api/v1.0/messageSend?pbx=3cx`

### Inbound Setup

1. Find your 3CX provided Webhook in 3CX -> SIP Trunks -> SMS
2. Copy the webhook URL 3CX is providing you
3. In the Bulk Solutions Portal:
   - Go to Portal -> Messaging -> Messaging Webhook
   - Create (or view existing webhook)
   - Paste the 3CX webhook in the URL section
   - Select the Method to be 3CX (default is POST)

## API Endpoints

### Inbound SMS

When a message is received, a POST request will be sent to your webhook with the following format:

```json
{ 
  "From": "(FROM NUMBER)",  
  "To": [  
    "(TO NUMBER)"  
  ],  
  "Message": "(UPTO-160-CHARACTER-MESSAGE)"  
}
```

Your server should respond with HTTP "200 OK" to acknowledge receipt.

### Inbound MMS

For MMS messages, your webhook will receive a POST with this format:

```json
{ 
  "From": "(FROM NUMBER)",
  "To": ["(TO NUMBER)"],
  "Message": "",
  "MediaURLs": [
    "https://s3.aws.com/file1.smil",
    "https://s3.aws.com/file2.jpg",
    "https://s3.aws.com/file3.txt"
  ] 
}
```

MMS messages may contain three files:

1. `.smil` file (Synchronized Multimedia Integration Language - may not be useful)
2. `.jpg` file (picture being sent)
3. `.txt` file (wording in the message)

Note: In some instances, the text body of the MMS message may come in as an attachment.

### Outbound SMS

To send an SMS message, make a POST request with this format:

```bash
curl -X POST "https://portal.bulkvs.com/api/v1.0/messageSend" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YWRtaW5AaGF2ZW5tZWRpYXNvbHV0aW9ucy5jb206NTlhOGNjZmE2ZmFhNDYyNWMzMzNhODFjNWQzOGNlNTU=" \
  -d '{
    "From": "(FROM NUMBER)",
    "To": [
      "(TO NUMBER)"
    ],
    "Message": "(UPTO-160-CHARACTER-MESSAGE)"
  }'
```

The response will be in this format:

```json
{
  "RefId": "(Reference ID for this Message)",
  "From": "(FROM NUMBER)",
  "MessageType": "SMS",
  "Results": [
    {
      "To": "(TO NUMBER)",
      "Status": "SUCCESS"
    }
  ]
}
```

### Outbound MMS

To send an MMS message with media attachments:

```bash
curl -X POST "https://portal.bulkvs.com/api/v1.0/messageSend" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YWRtaW5AaGF2ZW5tZWRpYXNvbHV0aW9ucy5jb206NTlhOGNjZmE2ZmFhNDYyNWMzMzNhODFjNWQzOGNlNTU=" \
  -d '{
    "From": "(FROM NUMBER)",
    "To": [
      "(TO NUMBER)"
    ],
    "Message": "(UPTO-160-CHARACTER-MESSAGE)",
    "MediaURLs": [
      "https://s3.aws.com/file1.png"
    ]
  }'
```

Important:

- The MediaURL must be a link to a JPEG or PNG file publicly accessible on the internet
- In the example above, we are sending the picture `https://s3.aws.com/file1.png`

The response will be in this format:

```json
{
  "RefId": "(Reference ID for this Message)",
  "From": "(FROM NUMBER)",
  "MessageType": "MMS",
  "Results": [
    {
      "To": "(TO NUMBER)",
      "Status": "SUCCESS"
    }
  ]
}
```

## Support

If you have any questions regarding integration, don't hesitate to contact BulkVS:

- Phone: 310-906-0901
- Email: [support@bulkvs.com](mailto:support@bulkvs.com)
