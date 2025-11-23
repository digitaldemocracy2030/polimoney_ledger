import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:polimoney_ledger/features/ledger/data/repositories/ledger_repository.dart';
import 'package:polimoney_ledger/features/ledger/domain/models/political_organization.dart';

class PoliticalOrganizationList extends StatefulWidget {
  const PoliticalOrganizationList({super.key});

  @override
  State<PoliticalOrganizationList> createState() =>
      _PoliticalOrganizationListState();
}

class _PoliticalOrganizationListState extends State<PoliticalOrganizationList> {
  late Future<List<PoliticalOrganization>> _organizationsFuture;

  @override
  void initState() {
    super.initState();
    // initState内で非同期処理を開始
    _organizationsFuture = _fetchOrganizations();
  }

  Future<List<PoliticalOrganization>> _fetchOrganizations() {
    // Provider経由でLedgerRepositoryのインスタンスを取得
    final ledgerRepository =
        Provider.of<LedgerRepository>(context, listen: false);
    final userId = Supabase.instance.client.auth.currentUser!.id;
    // リポジトリのメソッドを呼び出してデータを取得
    return ledgerRepository.fetchPoliticalOrganizations(userId);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<PoliticalOrganization>>(
      future: _organizationsFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(child: Text('エラー: ${snapshot.error}'));
        }
        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return const Center(child: Text('所属する政治団体はありません。'));
        }

        final organizations = snapshot.data!;

        return ListView.builder(
          itemCount: organizations.length,
          itemBuilder: (context, index) {
            final org = organizations[index];
            return ListTile(
              title: Text(org.name),
              trailing: const Icon(Icons.arrow_forward_ios),
              onTap: () {
                // TODO: Implement navigation to JournalListScreen
                print('Tapped on ${org.name} (ID: ${org.id})');
              },
            );
          },
        );
      },
    );
  }
}
