import { Match, Template } from '@aws-cdk/assertions';
import * as s3 from '@aws-cdk/aws-s3';
import * as sqs from '@aws-cdk/aws-sqs';
import { Stack } from '@aws-cdk/core';
import * as notif from '../lib';

test('queues can be used as destinations', () => {
  const stack = new Stack();

  const queue = new sqs.Queue(stack, 'Queue');
  const bucket = new s3.Bucket(stack, 'Bucket');

  bucket.addObjectRemovedNotification(new notif.SqsDestination(queue));

  Template.fromStack(stack).hasResourceProperties('AWS::SQS::QueuePolicy', {
    PolicyDocument: {
      Statement: [
        {
          Action: [
            'sqs:SendMessage',
            'sqs:GetQueueAttributes',
            'sqs:GetQueueUrl',
          ],
          Condition: {
            ArnLike: {
              'aws:SourceArn': { 'Fn::GetAtt': ['Bucket83908E77', 'Arn'] },
            },
          },
          Effect: 'Allow',
          Principal: {
            Service: 's3.amazonaws.com',
          },
          Resource: { 'Fn::GetAtt': ['Queue4A7E3555', 'Arn'] },

        },
      ],
      Version: '2012-10-17',
    },
    Queues: [
      {
        Ref: 'Queue4A7E3555',
      },
    ],
  });

  Template.fromStack(stack).hasResourceProperties('Custom::S3BucketNotifications', {
    BucketName: {
      Ref: 'Bucket83908E77',
    },
    NotificationConfiguration: {
      QueueConfigurations: [
        {
          Events: [
            's3:ObjectRemoved:*',
          ],
          QueueArn: {
            'Fn::GetAtt': [
              'Queue4A7E3555',
              'Arn',
            ],
          },
        },
      ],
    },
  });

  // make sure the queue policy is added as a dependency to the bucket
  // notifications resource so it will be created first.

  const resources = Template.fromStack(stack).findResources('Custom::S3BucketNotifications');

  expect(resources.BucketNotifications8F2E257D.DependsOn)
    .toEqual(['QueuePolicy25439813', 'Queue4A7E3555']);
});

test('if the queue is encrypted with a custom kms key, the key resource policy is updated to allow s3 to read messages', () => {
  const stack = new Stack();
  const bucket = new s3.Bucket(stack, 'Bucket');
  const queue = new sqs.Queue(stack, 'Queue', { encryption: sqs.QueueEncryption.KMS });

  bucket.addObjectCreatedNotification(new notif.SqsDestination(queue));

  Template.fromStack(stack).hasResourceProperties('AWS::KMS::Key', {
    KeyPolicy: {
      Statement: Match.arrayWith([{
        Action: [
          'kms:GenerateDataKey*',
          'kms:Decrypt',
        ],
        Effect: 'Allow',
        Principal: {
          Service: 's3.amazonaws.com',
        },
        Resource: '*',
      }]),
    },
  });
});
