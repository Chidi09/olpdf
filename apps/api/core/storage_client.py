from typing import Optional
import os
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config


class R2StorageClient:
    def __init__(self) -> None:
        self.access_key = os.getenv("R2_ACCESS_KEY_ID")
        self.secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
        self.endpoint_url = os.getenv("R2_ENDPOINT", "")
        self.bucket_name = os.getenv("R2_BUCKET_NAME", "olpdf-documents")

        if self.access_key and self.secret_key and self.endpoint_url:
            self.s3 = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=Config(signature_version="s3v4"),
                region_name="auto",
            )
        else:
            self.s3 = None

    def upload_bytes(self, data: bytes, object_name: str) -> Optional[str]:
        if not self.s3:
            return None
        try:
            self.s3.put_object(Body=data, Bucket=self.bucket_name, Key=object_name)
            return f"{self.endpoint_url}/{self.bucket_name}/{object_name}"
        except ClientError as exc:
            return None

    def download_bytes(self, object_name: str) -> Optional[bytes]:
        if not self.s3:
            return None
        try:
            res = self.s3.get_object(Bucket=self.bucket_name, Key=object_name)
            return res["Body"].read()
        except ClientError:
            return None

    def upload_file(self, file_path: str, object_name: str) -> Optional[str]:
        if not self.s3:
            raise ValueError("R2 Storage client is not configured.")
        try:
            self.s3.upload_file(file_path, self.bucket_name, object_name)
            return f"{self.endpoint_url}/{self.bucket_name}/{object_name}"
        except ClientError:
            return None

    def download_file(self, object_name: str, file_path: str) -> bool:
        if not self.s3:
            raise ValueError("R2 Storage client is not configured.")
        try:
            self.s3.download_file(self.bucket_name, object_name, file_path)
            return True
        except ClientError:
            return False

    def object_exists(self, object_name: str) -> bool:
        if not self.s3:
            return os.getenv("OLPDF_DEV_MODE") == "true"
        try:
            self.s3.head_object(Bucket=self.bucket_name, Key=object_name)
            return True
        except ClientError:
            return False

    def generate_presigned_url(self, object_name: str, expiration: int = 3600) -> Optional[str]:
        if not self.s3:
            if os.getenv("OLPDF_DEV_MODE") == "true":
                return f"http://localhost:9000/{self.bucket_name}/{object_name}"
            return None
        try:
            return self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": object_name},
                ExpiresIn=expiration,
            )
        except ClientError:
            return None


r2_storage = R2StorageClient()
