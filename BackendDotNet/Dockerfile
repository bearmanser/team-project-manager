FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY BackendDotNet/BackendDotNet.csproj BackendDotNet/
RUN dotnet restore BackendDotNet/BackendDotNet.csproj

COPY BackendDotNet/ BackendDotNet/
RUN dotnet publish BackendDotNet/BackendDotNet.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8000
EXPOSE 8000

ENTRYPOINT ["dotnet", "BackendDotNet.dll"]
