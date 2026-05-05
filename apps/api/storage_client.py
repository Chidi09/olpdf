from typing import Optional
import os
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

class R2StorageClient:
    def __init__(self):
        # Cloudflare R2 S3-compatible configuration
        self.account_id = os.getenv("R2_ACCOUNT_ID")
        self.access_key = os.getenv("R2_ACCESS_KEY_ID")
        self.secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
        self.bucket_name = os.getenv("R2_BUCKET_NAME", "olpdf-storage")
        
        self.endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
        
        if self.account_id and self.access_key and self.secret_key:
            self.s3 = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=Config(signature_version='s3v4'),
                region_name='auto'
            )
        else:
            self.s3 = None

    def upload_file(self, file_path: str, object_name: str) -> str:
        """Upload a file to an R2 bucket"""
        if not self.s3:
            raise ValueError("R2 Storage client is not configured properly.")
            
        try:
            self.s3.upload_file(file_path, self.bucket_name, object_name)
            # Generate a pre-signed URL or public URL depending on bucket settings
            return f"{self.endpoint_url}/{self.bucket_name}/{object_name}"
        except ClientError as e:
            print(f"Error uploading file to R2: {e}")
            return None

    def download_file(self, object_name: str, file_path: str):
        """Download a file from an R2 bucket"""
        if not self.s3:
            raise ValueError("R2 Storage client is not configured properly.")
            
        try:
            self.s3.download_file(self.bucket_name, object_name, file_path)
            return True
        except ClientError as e:
            print(f"Error downloading file from R2: {e}")
            return False

    def upload_bytes(self, data: bytes, object_name: str) -> Optional[str]:
        """Upload bytes to an R2 bucket"""
        if not self.s3:
            return None
        try:
            self.s3.put_object(Body=data, Bucket=self.bucket_name, Key=object_name)
            return f"{self.endpoint_url}/{self.bucket_name}/{object_name}"
        except ClientError as e:
            print(f"Error uploading bytes to R2: {e}")
            return None

    def download_bytes(self, object_name: str) -> Optional[bytes]:
        """Download bytes from an R2 bucket"""
        if not self.s3:
            return None
        try:
            res = self.s3.get_object(Bucket=self.bucket_name, Key=object_name)
            return res['Body'].read()
        except ClientError as e:
            print(f"Error downloading bytes from R2: {e}")
            return None

    def generate_presigned_url(self, object_name: str, expiration: int = 3600) -> Optional[str]:
        """Generate a pre-signed URL to share an R2 object"""
        if not self.s3:
            # Fallback for local development
            if os.getenv("OLPDF_DEV_MODE") == "true":
                return f"http://localhost:9000/{self.bucket_name}/{object_name}"
            return None
        try:
            response = self.s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': object_name},
                ExpiresIn=expiration
            )
            return response
        except ClientError as e:
            print(f"Error generating presigned URL: {e}")
            return None

# Global instance
r2_storage = R2StorageClient()
