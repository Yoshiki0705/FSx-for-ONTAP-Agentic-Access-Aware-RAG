# Stage 2 Design: Code Interpreter, Video Analysis, Meeting Minutes, Video Generation
**🌐 Language:** [日本語](../genu-stage2-design.md) | **English**

---
## Conclusion
All four stage-2 features can be built in Tokyo (ap-northeast-1). The exception is video generation: no model that outputs video exists in Tokyo, and only one model in us-west-2 works. The implementation order is Code Interpreter, video analysis, meeting minutes, video generation. All four are switched by CDK context and disabled by default.

This is a design written before implementation, not a description of shipped behavior. The figures are results measured on 2026-11-15 from the AWS CLI and boto3, not measurements of a deployed application.

| Feature | Service | Processing Region | Measurement |
|---------|---------|-------------------|-------------|
| Code Interpreter | Amazon Bedrock AgentCore built-in Code Interpreter | ap-northeast-1 | `verified 2026-11-15 / ap-northeast-1` Python 3.12 (aarch64) ran |
| Video analysis | Amazon Bedrock Converse `video` block (`jp.amazon.nova-2-lite-v1:0`) | ap-northeast-1 | `verified 2026-11-15 / ap-northeast-1` read on-screen text correctly |
| Meeting minutes | Amazon Transcribe (`ja-JP`, speaker labels) and Bedrock | ap-northeast-1 | `verified 2026-11-15 / ap-northeast-1` transcribed one Japanese sentence almost verbatim |
| Video generation | Amazon Bedrock `luma.ray-v2:0` (asynchronous invocation) | us-west-2 (outside Japan) | `verified 2026-11-15 / us-west-2` one 5-second 540p clip finished in 36 seconds |

## Terms
- **FSx for ONTAP S3 Access Points**: an entry point for reading and writing an Amazon FSx for NetApp ONTAP volume through S3 APIs. In this document the alias (a name ending in `…-ext-s3alias`) is passed where an S3 bucket name would go.
- **File portal**: a separate repository's screen that reads and writes files through FSx for ONTAP S3 Access Points ([FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns)).
- **RAG app**: the Next.js application in this repository.

---
## Design by Feature
### Code Interpreter
- Use the built-in `aws.codeinterpreter.v1`. `verified 2026-11-15 / ap-northeast-1`: a session started and ran Python. Invocation is boto3 `bedrock-agentcore` `invoke_code_interpreter(name='executeCode', arguments={language, code})`. AWS CLI v2 has no invoke command.
- Only content from documents the user can read goes into the sandbox. Authorization uses the same permission tests as the stage-1 tools.
- Each run is limited to 60 seconds and each request to 3 runs.
- Execution sits in one module. **Information that Code Interpreter is heading for end of service has been received, but no official source was found** (AgentCore release notes checked through 2026-11). What is in maintenance mode, closed to new customers, is Bedrock Agents Classic and its own code-execution feature (since 2026-07-30, `documented`). If a replacement is needed, only this module is swapped.

### Video analysis
- Pass bytes or an S3 location (`s3Location`) in the Converse `video` block. `verified 2026-11-15 / ap-northeast-1`: both worked, including with an FSx for ONTAP S3 Access Points alias.
- Official limits are 25 MB total for base64 and 1 GB for an S3 URI (`documented`).
- File portal: the Lambda checks the path boundary itself, then passes `s3://<alias>/<key>` to Converse. No intermediate bucket is needed.
- RAG app: a request body through CloudFront and a Function URL is limited to about 6 MB. Upload directly to a staging bucket with a presigned URL. The bucket is encrypted and its lifecycle deletes objects after 1 day.

### Meeting minutes
- Transcribe `ja-JP` with speaker labels produces the transcript, and Bedrock shapes it into minutes. Passing `s3://<alias>/<key>` as `MediaFileUri` is described in the FSx for ONTAP tutorial (`documented`) and was confirmed by a run on the same day.
- Transcribe is used because, of the Voxtral models tried through the Converse `audio` block, mini reversed the meaning of a sentence while small kept it. Both results come from one sentence and are not generalized.
- The staging bucket is handled as for video analysis. The file portal does not need one.

### Video generation
- No model that outputs video was found in ap-northeast-1, us-east-1, eu-west-1, eu-central-1, ap-southeast-1, or ap-south-1. Only `luma.ray-v2:0` in us-west-2 works (`verified 2026-11-15`).
- Call `bedrock-runtime` `start_async_invoke` with an output S3 bucket in us-west-2. The input keys that worked are `prompt`, `aspect_ratio`, `resolution`, `duration` (`'5s'`), and `loop`. The output was h264 at 960×544, 311 KB.
- The feature is off by default. When enabled, the screen and the README state that video is processed outside Japan (us-west-2). The user approved this.
- The model availability API reported the agreement as `NOT_AVAILABLE`, yet the call succeeded. Availability is decided by the call result, not by that API.

---
## Services That Accept an FSx for ONTAP S3 Access Points Alias
`verified 2026-11-15 / ap-northeast-1` (Internet origin, UNIX root user, a role allowing only the access point ARN).

| Service | Result |
|---------|--------|
| Transcribe (`MediaFileUri`) | Accepts |
| Bedrock Converse (video `s3Location`) | Accepts |
| Textract (sync `DetectDocumentText`, async `StartDocumentTextDetection`, Tokyo endpoint) | Accepts |
| Comprehend (async job) | Accepts |
| Rekognition (`DetectText`, `DetectLabels`, `StartLabelDetection`) | Does not accept. The same calls succeed with an ordinary bucket |
| Translate (`StartTextTranslationJob`) | Does not accept. The same call succeeds with an ordinary bucket |

A feature request has been filed with AWS Support for each of Rekognition and Translate. Stage 2 uses neither.

Textract called from a Region other than the bucket's failed with `InvalidS3ObjectException` for both an alias and an ordinary bucket (`verified 2026-11-15`, us-east-1 calling a Tokyo bucket). The 2026-08 record that "Textract fails" may have come from such a cross-region call, but the calling Region was not recorded, so this is a `hypothesis`.

---
## FAQ
**Q. Why is only video generation processed outside Japan?**
A. No model that outputs video was found in Tokyo or in the five other Regions checked (us-east-1, eu-west-1, eu-central-1, ap-southeast-1, ap-south-1). Only `luma.ray-v2:0` in us-west-2 worked.

**Q. Will Code Interpreter stop being available?**
A. No official source was found. The only confirmed item is the maintenance mode of Bedrock Agents Classic. Keeping execution in one module is the hedge against this uncertainty.

**Q. Is the meeting-minutes accuracy sufficient?**
A. It was measured on one Japanese sentence only, not on meeting recordings. A measurement on realistic recordings is needed (`hypothesis`).

## Next Steps
1. Add Code Interpreter to both apps (an agent tool in the RAG app, `functions/file-tools` in the file portal), with permission tests and run-time limit tests.
2. Add video analysis, meeting minutes, and video generation in that order. For each: 8-language strings, a check on a live deployment, screenshots, and teardown.

## Related Documents
- [Implementation Overview](implementation-overview.md)
- [Evidence Policy](../evidence-policy.md)
- [Evaluation](evaluation.md)
